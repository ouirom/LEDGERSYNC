import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import prisma from '../config/db';
import { emitJobProgress, emitJobCompleted, emitJobFailed } from '../sockets/socketServer';
import { readSheet } from 'read-excel-file/node';
import fs from 'fs';
import path from 'path';

const CHUNK_SIZE = 500;
const IMPORT_QUEUE_NAME = 'import-queue';

// Détecte le séparateur CSV (virgule ou point-virgule, courant dans les exports FR)
// en comptant les occurrences sur la ligne d'en-tête.
function detectCsvDelimiter(headerLine: string): string {
  const commas = (headerLine.match(/,/g) || []).length;
  const semicolons = (headerLine.match(/;/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      result.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

function parseCsv(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r\n|\n|\r/).filter(l => l.length > 0);
  if (lines.length === 0) return [];
  const delimiter = detectCsvDelimiter(lines[0]!);
  const headers = parseCsvLine(lines[0]!, delimiter).map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = parseCsvLine(line, delimiter);
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
    return row;
  });
}

// Lit un fichier .xlsx (read-excel-file) ou .csv (parseur maison) et le
// normalise en tableau d'objets {en-tête: valeur}, comme le faisait XLSX.utils.sheet_to_json.
async function parseSourceFile(filePath: string): Promise<Record<string, unknown>[]> {
  if (path.extname(filePath).toLowerCase() === '.csv') {
    return parseCsv(fs.readFileSync(filePath, 'utf8'));
  }
  const rows = await readSheet(filePath); // première feuille par défaut
  if (rows.length === 0) return [];
  const headers = rows[0]!.map(h => String(h ?? '').trim());
  return rows.slice(1).map(row => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
    return obj;
  });
}

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

    // Lire le fichier Excel / CSV
    const rows = await parseSourceFile(filePath);

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

        // read-excel-file convertit nativement les cellules-date Excel en objets Date,
        // mais une date saisie comme texte JJ/MM/AAAA reste une chaîne. Le constructeur
        // Date() natif interprète "14/07/2026" en MM/DD/YYYY (donc invalide : mois 14),
        // d'où un parseur JJ/MM/AAAA explicite plutôt que de se fier au format US ambigu.
        const toDate = (v: unknown): Date => {
          if (v instanceof Date) return v;
          const s = String(v || '').trim();
          const m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
          if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
          return new Date(s);
        };

        const montantRaw = parseFloat(
          String(getCol('montant', 'amount', 'debit_credit') || '0')
            .replace(/\s/g, '').replace(',', '.')
        );
        const type: 'DEBIT' | 'CREDIT' = montantRaw < 0 ? 'DEBIT' : 'CREDIT';
        const dateValeurRaw = getCol('date valeur', 'date_valeur');

        return {
          compte_bancaire_id: compteId,
          reference: String(getCol('reference', 'référence', 'ref', 'num_operation') || ''),
          libelle: String(getCol('libelle', 'libellé', 'libellé', 'description', 'motif') || 'Sans libellé'),
          montant: Math.abs(montantRaw),
          type,
          date_operation: toDate(getCol('date', 'date_operation', 'date opération', 'date_value')),
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
