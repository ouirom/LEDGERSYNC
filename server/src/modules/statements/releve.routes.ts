import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { importQueue } from '../../workers/importWorker';

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
    const allowed = ['.xlsx', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Format non supporté. Utilisez .xlsx ou .csv (le format .xls hérité n\'est plus accepté).'));
  },
});

// POST /api/releves/import — Upload + enqueue BullMQ job
router.post('/import', upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ success: false, message: 'Fichier requis' }); return; }

  const { compte_bancaire_id, template_id } = req.body as { compte_bancaire_id: string; template_id?: string };
  if (!compte_bancaire_id) { res.status(400).json({ success: false, message: 'compte_bancaire_id requis' }); return; }

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
        nom_fichier: req.file.originalname,
        statut: 'EN_ATTENTE',
        resultat: { compteId: parseInt(compte_bancaire_id), templateId: template_id ? parseInt(template_id) : undefined },
        etat: 'BROUILLON',
        created_by: req.user!.userId,
        updated_by: req.user!.userId,
      },
    });

    // Enregistrer le fichier source
    await prisma.fichierSource.create({
      data: {
        job_id: jobRecord.id,
        tenant_id: req.user!.tenantId,
        nom_original: req.file.originalname,
        nom_stockage: req.file.filename,
        url: `/uploads/${req.file.filename}`,
        type_fichier: 'EXCEL',
        taille_octets: req.file.size,
        etat: 'BROUILLON',
        created_by: req.user!.userId,
        updated_by: req.user!.userId,
      },
    });

    // Enqueue BullMQ job
    const bullJob = await importQueue.add(`import-${jobRecord.id}`, {
      jobId: jobRecord.id,
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      filePath: req.file.path,
      compteId: parseInt(compte_bancaire_id),
      templateId: template_id ? parseInt(template_id) : undefined,
    });

    await prisma.jobTraitement.update({
      where: { id: jobRecord.id },
      data: { bull_job_id: bullJob.id?.toString(), updated_by: req.user!.userId },
    });

    res.status(202).json({
      success: true,
      message: 'Import démarré en arrière-plan',
      data: { jobId: jobRecord.id, bullJobId: bullJob.id },
    });
  } catch (err) {
    console.error('[RELEVE/IMPORT]', err);
    res.status(500).json({ success: false, message: 'Erreur lors du démarrage de l\'import' });
  }
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
