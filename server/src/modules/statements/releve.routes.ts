import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { importQueue } from '../../workers/importWorker';
import { parseSourceFile, toPreviewLigne } from '../../utils/statementParser';

const router = Router();
router.use(authenticate);

const storage = multer.diskStorage({
  destination: process.env.UPLOAD_DIR || './uploads',
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '50')) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // .xls (format binaire Excel 97-2003) n'est plus accepté : la bibliothèque de lecture
    // (read-excel-file, sans vulnérabilité connue) ne supporte que le format .xlsx (OOXML) et .csv,
    // contrairement à l'ancienne dépendance xlsx/SheetJS qui présentait des failles non corrigées.
    const allowed = ['.xlsx', '.csv', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Format non supporté. Utilisez .xlsx, .csv ou .pdf (le format .xls hérité n\'est plus accepté).'));
  },
});

// POST /api/releves/preview — Parse une ou plusieurs pages sans rien persister,
// pour permettre à l'utilisateur de vérifier les données avant de valider l'import.
router.post('/preview', upload.array('files', 20), async (req: AuthRequest, res: Response): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) { res.status(400).json({ success: false, message: 'Au moins un fichier requis' }); return; }

  try {
    const pages = await Promise.all(files.map(async f => {
      const rows = await parseSourceFile(f.path);
      return { nom: f.originalname, nb_lignes: rows.length, lignes: rows.map(toPreviewLigne) };
    }));

    const toutesLesLignes = pages.flatMap(p => p.lignes);
    const totalLignes = toutesLesLignes.length;
    const lignesInvalides = toutesLesLignes.filter(l => !l.valide).length;
    const lignesIncertaines = toutesLesLignes.filter(l => l.valide && l.incertain).length;

    res.json({
      success: true,
      data: {
        nb_pages: files.length,
        total_lignes: totalLignes,
        lignes_invalides: lignesInvalides,
        lignes_incertaines: lignesIncertaines,
        pages: pages.map(p => ({ nom: p.nom, nb_lignes: p.nb_lignes })),
        apercu: toutesLesLignes.slice(0, 50),
      },
    });
  } catch (err) {
    console.error('[RELEVE/PREVIEW]', err);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'analyse du fichier' });
  } finally {
    // La prévisualisation ne persiste rien : les fichiers temporaires sont nettoyés immédiatement.
    for (const f of files || []) {
      if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
    }
  }
});

// POST /api/releves/import — Upload (une ou plusieurs pages) + création du relevé + enqueue BullMQ
router.post('/import', upload.array('files', 20), async (req: AuthRequest, res: Response): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) { res.status(400).json({ success: false, message: 'Au moins un fichier requis' }); return; }

  const { compte_bancaire_id, template_id, reference, date_debut, date_fin } = req.body as Record<string, string | undefined>;
  if (!compte_bancaire_id) { res.status(400).json({ success: false, message: 'compte_bancaire_id requis' }); return; }

  const compte = await prisma.compteBancaire.findFirst({
    where: { id: parseInt(compte_bancaire_id), entreprise: { tenant_id: req.user!.tenantId } },
  });
  if (!compte) { res.status(404).json({ success: false, message: 'Compte bancaire non trouvé' }); return; }

  try {
    // Créer le job en base
    // Le compteId/templateId est stocké dès la création (dans `resultat`) afin que
    // le mécanisme de reprise (resume) puisse le retrouver même si le job échoue ou est annulé
    // avant d'atteindre son état COMPLETE (seul moment où `resultat` était renseigné auparavant).
    const jobRecord = await prisma.jobTraitement.create({
      data: {
        tenant_id: req.user!.tenantId,
        utilisateur_id: req.user!.userId,
        type_job: 'IMPORT_RELEVE',
        nom_fichier: files.length === 1 ? files[0]!.originalname : `${files.length} fichiers`,
        statut: 'EN_ATTENTE',
        resultat: { compteId: parseInt(compte_bancaire_id), templateId: template_id ? parseInt(template_id) : undefined },
        etat: 'BROUILLON',
        created_by: req.user!.userId,
        updated_by: req.user!.userId,
      },
    });

    // Un relevé bancaire regroupe toutes les pages de cet import sous une seule entité.
    const releveBancaire = await prisma.releveBancaire.create({
      data: {
        compte_bancaire_id: compte.id,
        job_id: jobRecord.id,
        reference: reference || null,
        date_debut: date_debut ? new Date(date_debut) : null,
        date_fin: date_fin ? new Date(date_fin) : null,
        nb_pages: files.length,
        etat: 'BROUILLON',
        created_by: req.user!.userId,
        updated_by: req.user!.userId,
      },
    });

    // Enregistrer chaque page comme fichier source
    await prisma.fichierSource.createMany({
      data: files.map(f => ({
        job_id: jobRecord.id,
        tenant_id: req.user!.tenantId,
        nom_original: f.originalname,
        nom_stockage: f.filename,
        url: `/uploads/${f.filename}`,
        type_fichier: path.extname(f.originalname).toLowerCase() === '.pdf' ? ('PDF' as const) : ('EXCEL' as const),
        taille_octets: f.size,
        etat: 'BROUILLON' as const,
        created_by: req.user!.userId,
        updated_by: req.user!.userId,
      })),
    });

    // Enqueue BullMQ job
    const bullJob = await importQueue.add(`import-${jobRecord.id}`, {
      jobId: jobRecord.id,
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      filePaths: files.map(f => f.path),
      compteId: compte.id,
      releveBancaireId: releveBancaire.id,
      templateId: template_id ? parseInt(template_id) : undefined,
    });

    await prisma.jobTraitement.update({
      where: { id: jobRecord.id },
      data: { bull_job_id: bullJob.id?.toString(), updated_by: req.user!.userId },
    });

    res.status(202).json({
      success: true,
      message: 'Import démarré en arrière-plan',
      data: { jobId: jobRecord.id, bullJobId: bullJob.id, releveBancaireId: releveBancaire.id },
    });
  } catch (err) {
    console.error('[RELEVE/IMPORT]', err);
    res.status(500).json({ success: false, message: 'Erreur lors du démarrage de l\'import' });
  }
});

// GET /api/releves/statements?compte_bancaire_id=X — Liste des relevés (une banque, via ses comptes, peut en avoir plusieurs)
router.get('/statements', async (req: AuthRequest, res: Response): Promise<void> => {
  const { compte_bancaire_id, page = '1', limit = '50' } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  try {
    const where: Prisma.ReleveBancaireWhereInput = { compte_bancaire: { entreprise: { tenant_id: req.user!.tenantId } } };
    if (compte_bancaire_id) where.compte_bancaire_id = parseInt(compte_bancaire_id as string);

    const [data, total] = await Promise.all([
      prisma.releveBancaire.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { created_at: 'desc' },
        include: {
          compte_bancaire: { select: { id: true, intitule: true, banque: { select: { nom: true } } } },
          _count: { select: { lignes: true } },
        },
      }),
      prisma.releveBancaire.count({ where }),
    ]);

    res.json({ success: true, data, meta: { total, page: parseInt(page as string), limit: parseInt(limit as string) } });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// GET /api/releves/statements/:id — Détail d'un relevé + ses lignes
router.get('/statements/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'] as string);
  try {
    const releve = await prisma.releveBancaire.findFirst({
      where: { id, compte_bancaire: { entreprise: { tenant_id: req.user!.tenantId } } },
      include: {
        compte_bancaire: { select: { id: true, intitule: true, banque: { select: { nom: true } } } },
        lignes: { orderBy: { num_ligne: 'asc' } },
      },
    });
    if (!releve) { res.status(404).json({ success: false, message: 'Relevé non trouvé' }); return; }
    res.json({ success: true, data: releve });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// GET /api/releves?compte_bancaire_id=X&page=1
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { compte_bancaire_id, page = '1', limit = '100' } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  try {
    const where: Prisma.ReleveBancaireLigneWhereInput = {
      compte_bancaire: { entreprise: { tenant_id: req.user!.tenantId } },
      etat: { not: 'ANNULE' },
    };
    if (compte_bancaire_id) where.compte_bancaire_id = parseInt(compte_bancaire_id as string);

    const [data, total] = await Promise.all([
      prisma.releveBancaireLigne.findMany({ where, skip, take: parseInt(limit as string), orderBy: { date_operation: 'desc' } }),
      prisma.releveBancaireLigne.count({ where }),
    ]);

    res.json({ success: true, data, meta: { total, page: parseInt(page as string), limit: parseInt(limit as string) } });
  } catch {
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

export default router;
