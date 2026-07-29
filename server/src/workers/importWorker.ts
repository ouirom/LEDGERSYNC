import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import prisma from '../config/db';
import { emitJobProgress, emitJobCompleted, emitJobFailed } from '../sockets/socketServer';
import * as XLSX from 'xlsx';
import fs from 'fs';

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
  filePath: string;
  compteId: number;
  templateId?: number;
  resumeFromIndex?: number;
}

// ── Worker ────────────────────────────────────────────────
export const importWorker = new Worker<ImportJobData>(
  IMPORT_QUEUE_NAME,
  async (job: Job<ImportJobData>) => {
    const { jobId, tenantId, userId, filePath, compteId, resumeFromIndex = 0 } = job.data;

    const startTime = Date.now();

    // Lire le fichier Excel
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

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
        // Détection flexible des colonnes (insensible à la casse)
        const getCol = (...keys: string[]) => {
          for (const k of keys) {
            const found = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
            if (found !== undefined) return row[found];
          }
          return '';
        };

        const montantRaw = parseFloat(
          String(getCol('montant', 'amount', 'debit_credit') || '0')
            .replace(/\s/g, '').replace(',', '.')
        );
        const type: 'DEBIT' | 'CREDIT' = montantRaw < 0 ? 'DEBIT' : 'CREDIT';
        const dateRaw = String(getCol('date', 'date_operation', 'date opération', 'date_value') || '');

        return {
          compte_bancaire_id: compteId,
          reference: String(getCol('reference', 'référence', 'ref', 'num_operation') || ''),
          libelle: String(getCol('libelle', 'libellé', 'libellé', 'description', 'motif') || 'Sans libellé'),
          montant: Math.abs(montantRaw),
          type,
          date_operation: new Date(dateRaw),
          date_valeur: getCol('date valeur', 'date_valeur') ? new Date(String(getCol('date valeur', 'date_valeur'))) : null,
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

    // Ne pas supprimer le fichier si c'est un resume (pourrait encore en avoir besoin)
    // Le fichier est supprimé uniquement à la fin du job complet (sans erreur)
    if (fs.existsSync(filePath) && erreurs === 0) fs.unlinkSync(filePath);

    const resultat = { lignesTraitees, totalLignes, erreurs, compteId };

    await prisma.jobTraitement.update({
      where: { id: jobId },
      data: { statut: 'COMPLETE', progression: 100, resultat, updated_by: userId },
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
