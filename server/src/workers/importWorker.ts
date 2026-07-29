import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import prisma from '../config/db';
import { emitJobProgress, emitJobCompleted, emitJobFailed } from '../sockets/socketServer';
import fs from 'fs';
import { parseSourceFile, getCol, toDate, parseMontantColumns, isRowAmbiguous } from '../utils/statementParser';

// Note : les lignes signalées "incertaines" par le parseur PDF (sens débit/crédit
// non garanti, voir statementParser.ts) restent importées — le libellé porte la
// mention d'avertissement pour rester vérifiable après coup dans le grand livre.

const CHUNK_SIZE = 500;
const IMPORT_QUEUE_NAME = 'import-queue';

// ── Queue Definition ─────────────────────────────────────
export const importQueue = new Queue(IMPORT_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

interface ImportJobData {
  jobId: number;
  tenantId: number;
  userId: number;
  filePaths: string[];
  compteId: number;
  releveBancaireId: number;
  templateId?: number;
  resumeFromIndex?: number;
}

// ── Worker ────────────────────────────────────────────────
export const importWorker = new Worker<ImportJobData>(
  IMPORT_QUEUE_NAME,
  async (job: Job<ImportJobData>) => {
    const { jobId, tenantId, userId, filePaths, compteId, releveBancaireId, resumeFromIndex = 0 } = job.data;

    const startTime = Date.now();

    // Lire toutes les pages du relevé (un ou plusieurs fichiers) et les concaténer
    // dans l'ordre d'upload — un relevé bancaire peut comporter plusieurs pages.
    const rowsPerFile = await Promise.all(filePaths.map(fp => parseSourceFile(fp)));
    const rows = rowsPerFile.flat();

    const totalLignes = rows.length;

    // Mettre à jour le job en base
    await prisma.jobTraitement.update({
      where: { id: jobId },
      data: { statut: 'EN_COURS', total_lignes: totalLignes, updated_by: userId },
    });

    let lignesTraitees = resumeFromIndex;
    let erreurs = 0;

    // Traitement par chunks
    for (let i = resumeFromIndex; i < rows.length; i += CHUNK_SIZE) {
      // Vérifier si le job est annulé
      const jobStatus = await prisma.jobTraitement.findUnique({ where: { id: jobId } });
      if (jobStatus?.statut === 'ANNULE') {
        console.log(`[Worker] Job ${jobId} annulé à la ligne ${i}`);
        return { annule: true, lignesTraitees };
      }

      const chunk = rows.slice(i, i + CHUNK_SIZE);

      const lignesData = chunk.map((row, idx) => {
        const { montant, type } = parseMontantColumns(row);
        const dateValeurRaw = getCol(row, 'date valeur', 'date_valeur');
        const libelleBrut = String(getCol(row, 'libelle', 'libellé', 'description', 'motif') || 'Sans libellé');

        return {
          compte_bancaire_id: compteId,
          releve_bancaire_id: releveBancaireId,
          reference: String(getCol(row, 'reference', 'référence', 'ref', 'num_operation') || ''),
          libelle: isRowAmbiguous(row) ? `${libelleBrut} (sens débit/crédit incertain — à vérifier)` : libelleBrut,
          montant,
          type,
          date_operation: toDate(getCol(row, 'date', 'date_operation', 'date opération', 'date_value')),
          date_valeur: dateValeurRaw ? toDate(dateValeurRaw) : null,
          num_ligne: i + idx + 1,
          etat: 'BROUILLON' as const,
          created_by: userId,
          updated_by: userId,
        };
      }).filter(l => !isNaN(l.montant) && !isNaN(l.date_operation.getTime()));

      try {
        await prisma.releveBancaireLigne.createMany({ data: lignesData, skipDuplicates: true });
        lignesTraitees += chunk.length;
      } catch (err) {
        erreurs += chunk.length;
        console.error(`[Worker] Erreur chunk ${i}-${i + CHUNK_SIZE}:`, err);
      }

      // Progression
      const progression = Math.round((lignesTraitees / totalLignes) * 100);
      const elapsed = (Date.now() - startTime) / 1000;
      const eta = lignesTraitees > 0 ? Math.round((elapsed / lignesTraitees) * (totalLignes - lignesTraitees)) : null;

      await prisma.jobTraitement.update({
        where: { id: jobId },
        data: {
          lignes_traitees: lignesTraitees,
          index_derniere_ligne: i + CHUNK_SIZE,
          progression,
          updated_by: userId,
        },
      });

      emitJobProgress(String(jobId), {
        progression,
        lignesTraitees,
        totalLignes,
        etaSeconds: eta ?? undefined,
        statut: 'EN_COURS',
      });

      // Pause pour éviter d'écraser MySQL
      await new Promise(r => setTimeout(r, 50));
    }

    // Ne pas supprimer les fichiers si c'est un resume (pourrait encore en avoir besoin)
    // Les fichiers ne sont supprimés qu'à la fin du job complet (sans erreur)
    if (erreurs === 0) {
      for (const fp of filePaths) {
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
    }

    const resultat = { lignesTraitees, totalLignes, erreurs, compteId, releveBancaireId };

    await prisma.jobTraitement.update({
      where: { id: jobId },
      data: { statut: 'COMPLETE', progression: 100, resultat, updated_by: userId },
    });

    await prisma.releveBancaire.update({
      where: { id: releveBancaireId },
      data: { etat: 'VALIDE', updated_by: userId },
    });

    emitJobCompleted(String(jobId), resultat);
    return resultat;
  },
  {
    connection: redis,
    concurrency: 3,
    limiter: { max: 10, duration: 1000 },
  }
);

importWorker.on('failed', async (job, err) => {
  if (!job) return;
  console.error(`[Worker] Job ${job.data.jobId} failed:`, err.message);
  await prisma.jobTraitement.update({
    where: { id: job.data.jobId },
    data: { statut: 'ECHOUE', message_erreur: err.message, updated_by: job.data.userId },
  });
  emitJobFailed(String(job.data.jobId), err.message);
});

console.log('🔄 Import Worker started and listening...');
