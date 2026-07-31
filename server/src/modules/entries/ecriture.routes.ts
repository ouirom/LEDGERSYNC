import { Router, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { createAuditEntry } from '../../middleware/auditLogger';
import { parseSourceFile, toPreviewLigne, parseMontantColumns, getLibelle, getCol, toDate } from '../../utils/statementParser';

const router = Router();
router.use(authenticate);

const ecritureSchema = z.object({
  entreprise_id: z.number().int().positive(),
  compte_bancaire_id: z.number().int().positive().optional(),
  reference: z.string().min(1),
  libelle: z.string().min(1),
  montant: z.number().positive(),
  type: z.enum(['DEBIT', 'CREDIT']),
  date_ecriture: z.string(),
  date_valeur: z.string().optional(),
  piece_ref: z.string().optional(),
  periode_mois: z.number().int().min(1).max(12),
  periode_annee: z.number().int().min(2000),
});

async function isPeriodeLocked(entrepriseId: number, mois: number, annee: number): Promise<boolean> {
  const periode = await prisma.periodeComptable.findUnique({ where: { entreprise_id_mois_annee: { entreprise_id: entrepriseId, mois, annee } } });
  return !!periode && (periode.statut === 'VERROUILLE' || periode.statut === 'CLOS');
}

// GET /api/ecritures
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { compte_bancaire_id, mois, annee, lettree, page = '1' } = req.query;
  const skip = (parseInt(page as string) - 1) * 100;
  try {
    const where: Prisma.EcritureComptableWhereInput = {
      entreprise: { tenant_id: req.user!.tenantId },
      etat: { not: 'ANNULE' },
    };
    if (compte_bancaire_id) where.compte_bancaire_id = parseInt(compte_bancaire_id as string);
    if (mois) where.periode_mois = parseInt(mois as string);
    if (annee) where.periode_annee = parseInt(annee as string);
    if (lettree !== undefined) where.lettree = lettree === 'true';

    const [data, total] = await Promise.all([
      prisma.ecritureComptable.findMany({ where, skip, take: 100, orderBy: { date_ecriture: 'asc' } }),
      prisma.ecritureComptable.count({ where }),
    ]);
    res.json({ success: true, data, meta: { total, page: parseInt(page as string) } });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// POST /api/ecritures — Saisie manuelle d'une écriture
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = ecritureSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }

  if (await isPeriodeLocked(parsed.data.entreprise_id, parsed.data.periode_mois, parsed.data.periode_annee)) {
    res.status(423).json({ success: false, message: 'Période verrouillée', code: 'PERIOD_LOCKED' }); return;
  }

  try {
    const data = await prisma.ecritureComptable.create({
      data: {
        ...parsed.data,
        date_ecriture: new Date(parsed.data.date_ecriture),
        date_valeur: parsed.data.date_valeur ? new Date(parsed.data.date_valeur) : null,
        etat: 'BROUILLON',
        created_by: req.user!.userId,
        updated_by: req.user!.userId,
      },
    });
    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'ECRITURE_COMPTABLE', entiteId: data.id, action: 'CREATE', apres: { reference: data.reference, libelle: data.libelle, montant: data.montant, type: data.type }, ipAddress: req.ip });
    res.status(201).json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// ── Import CSV/Excel/PDF (même moteur de parsing que l'import de relevés) ──
const storage = multer.diskStorage({
  destination: process.env.UPLOAD_DIR || './uploads',
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '50')) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.xlsx', '.csv', '.pdf'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Format non supporté. Utilisez .xlsx, .csv ou .pdf.'));
  },
});

// POST /api/ecritures/preview — Parse sans rien persister
router.post('/preview', upload.array('files', 20), async (req: AuthRequest, res: Response): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) { res.status(400).json({ success: false, message: 'Au moins un fichier requis' }); return; }

  try {
    const pages = await Promise.all(files.map(async f => {
      const rows = await parseSourceFile(f.path);
      return { nom: f.originalname, nb_lignes: rows.length, lignes: rows.map(toPreviewLigne) };
    }));
    const toutesLesLignes = pages.flatMap(p => p.lignes);
    const lignesValides = toutesLesLignes.filter(l => l.valide);

    res.json({
      success: true,
      data: {
        nb_pages: files.length,
        total_lignes: toutesLesLignes.length,
        lignes_invalides: toutesLesLignes.length - lignesValides.length,
        lignes_incertaines: lignesValides.filter(l => l.incertain).length,
        total_debit: lignesValides.reduce((s, l) => s + (l.debit ?? 0), 0),
        total_credit: lignesValides.reduce((s, l) => s + (l.credit ?? 0), 0),
        pages: pages.map(p => ({ nom: p.nom, nb_lignes: p.nb_lignes })),
        apercu: toutesLesLignes.slice(0, 50),
      },
    });
  } catch (err) {
    console.error('[ECRITURES/PREVIEW]', err);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'analyse du fichier' });
  } finally {
    for (const f of files || []) { try { fs.unlinkSync(f.path); } catch { /* déjà nettoyé */ } }
  }
});

const importBodySchema = z.object({
  compte_bancaire_id: z.coerce.number().int().positive(),
});

// POST /api/ecritures/import — Parse + crée les écritures (synchrone : volumes
// d'écritures saisies/importées manuellement, sans commune mesure avec un
// relevé bancaire complet — pas besoin de la file BullMQ dédiée à ce dernier).
// Le compte bancaire est obligatoire (pas seulement l'entreprise) : c'est ce
// qui rattache chaque écriture créée à un compte, condition pour qu'elle
// apparaisse dans l'espace de rapprochement (filtré par compte_bancaire_id).
router.post('/import', upload.array('files', 20), async (req: AuthRequest, res: Response): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) { res.status(400).json({ success: false, message: 'Au moins un fichier requis' }); return; }
  const parsedBody = importBodySchema.safeParse(req.body);
  if (!parsedBody.success) { res.status(400).json({ success: false, errors: parsedBody.error.flatten() }); return; }
  const { compte_bancaire_id } = parsedBody.data;

  const compte = await prisma.compteBancaire.findFirst({ where: { id: compte_bancaire_id, entreprise: { tenant_id: req.user!.tenantId } } });
  if (!compte) { res.status(404).json({ success: false, message: 'Compte bancaire non trouvé' }); return; }
  const entreprise_id = compte.entreprise_id;

  try {
    const rowsPerFile = await Promise.all(files.map(f => parseSourceFile(f.path)));
    const rows = rowsPerFile.flat();

    const lockedPeriodesCache = new Map<string, boolean>();
    let creees = 0, ignoreesInvalides = 0, ignoreesPeriodeVerrouillee = 0;
    const now = new Date();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const { montant, type } = parseMontantColumns(row);
      const dateEcriture = toDate(getCol(row, 'date', 'date_operation', 'date opération', 'date_value'));
      if (isNaN(montant) || montant <= 0 || isNaN(dateEcriture.getTime())) { ignoreesInvalides++; continue; }

      const mois = dateEcriture.getMonth() + 1;
      const annee = dateEcriture.getFullYear();
      const cacheKey = `${mois}-${annee}`;
      if (!lockedPeriodesCache.has(cacheKey)) {
        lockedPeriodesCache.set(cacheKey, await isPeriodeLocked(entreprise_id, mois, annee));
      }
      if (lockedPeriodesCache.get(cacheKey)) { ignoreesPeriodeVerrouillee++; continue; }

      const dateValeurRaw = getCol(row, 'date valeur', 'date_valeur', 'valeur');
      const reference = String(getCol(row, 'reference', 'référence', 'ref', 'num_operation', 'piece_ref') || `IMP-${now.getTime()}-${i + 1}`);

      await prisma.ecritureComptable.create({
        data: {
          entreprise_id,
          compte_bancaire_id,
          reference,
          libelle: getLibelle(row),
          montant,
          type,
          date_ecriture: dateEcriture,
          date_valeur: dateValeurRaw ? toDate(dateValeurRaw) : null,
          periode_mois: mois,
          periode_annee: annee,
          etat: 'BROUILLON',
          created_by: req.user!.userId,
          updated_by: req.user!.userId,
        },
      });
      creees++;
    }

    await createAuditEntry({
      tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'ECRITURE_COMPTABLE', action: 'IMPORT',
      apres: { entreprise_id, fichiers: files.map(f => f.originalname), creees, ignoreesInvalides, ignoreesPeriodeVerrouillee },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: { total_lignes: rows.length, creees, ignoreesInvalides, ignoreesPeriodeVerrouillee } });
  } catch (err) {
    console.error('[ECRITURES/IMPORT]', err);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'import' });
  } finally {
    for (const f of files || []) { try { fs.unlinkSync(f.path); } catch { /* déjà nettoyé */ } }
  }
});

// POST /api/ecritures/:id/extourne — Soft delete (extourne)
router.post('/:id/extourne', async (req: AuthRequest, res: Response): Promise<void> => {
  const { motif } = req.body as { motif: string };
  if (!motif || motif.trim().length < 5) {
    res.status(400).json({ success: false, message: 'Motif d\'extourne obligatoire (min. 5 caractères)' }); return;
  }

  const id = parseInt(req.params['id'] as string);
  try {
    const ecriture = await prisma.ecritureComptable.findFirst({
      where: { id, entreprise: { tenant_id: req.user!.tenantId } },
    });
    if (!ecriture) { res.status(404).json({ success: false, message: 'Écriture non trouvée' }); return; }
    if (ecriture.etat === 'ANNULE') { res.status(400).json({ success: false, message: 'Écriture déjà annulée' }); return; }

    // Créer l'écriture d'extourne (contre-passation)
    const extourne = await prisma.$transaction(async (tx) => {
      await tx.ecritureComptable.update({
        where: { id },
        data: { etat: 'ANNULE', motif_annulation: motif, updated_by: req.user!.userId },
      });
      return tx.ecritureComptable.create({
        data: {
          entreprise_id: ecriture.entreprise_id,
          compte_bancaire_id: ecriture.compte_bancaire_id,
          reference: `EXT-${ecriture.reference}`,
          libelle: `EXTOURNE: ${ecriture.libelle}`,
          montant: ecriture.montant,
          type: ecriture.type === 'DEBIT' ? 'CREDIT' : 'DEBIT',
          date_ecriture: new Date(),
          periode_mois: ecriture.periode_mois,
          periode_annee: ecriture.periode_annee,
          extourne_de: id,
          motif_annulation: motif,
          etat: 'VALIDE',
          created_by: req.user!.userId,
          updated_by: req.user!.userId,
        },
      });
    });

    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'ECRITURE_COMPTABLE', entiteId: id, action: 'EXTOURNE', avant: { etat: ecriture.etat }, apres: { motif, extourne_id: extourne.id }, ipAddress: req.ip });
    res.status(201).json({ success: true, data: extourne, message: 'Extourne créée avec succès' });
  } catch { res.status(500).json({ success: false, message: 'Erreur lors de l\'extourne' }); }
});

export default router;
