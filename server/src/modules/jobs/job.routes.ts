import { Router, Response } from 'express';
import prisma from '../../config/db';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { importQueue } from '../../workers/importWorker';

const router = Router();
router.use(authenticate);

// GET /api/jobs — Lister les jobs du tenant
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { page = '1', limit = '20', statut } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  try {
    const where: Record<string, unknown> = { tenant_id: req.user!.tenantId };
    if (statut) where['statut'] = statut;

    const [data, total] = await Promise.all([
      prisma.jobTraitement.findMany({
        where: where as any,
        skip,
        take: parseInt(limit as string),
        orderBy: { created_at: 'desc' },
        include: { utilisateur: { select: { nom: true, prenom: true, email: true } } },
      }),
      prisma.jobTraitement.count({ where: where as any }),
    ]);

    res.json({ success: true, data, meta: { total, page: parseInt(page as string), limit: parseInt(limit as string) } });
  } catch {
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

// GET /api/jobs/:id — Statut d'un job
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const job = await prisma.jobTraitement.findFirst({
      where: { id: parseInt(req.params['id'] as string), tenant_id: req.user!.tenantId },
      include: { fichiers_sources: true },
    });
    if (!job) { res.status(404).json({ success: false, message: 'Job non trouvé' }); return; }
    res.json({ success: true, data: job });
  } catch {
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

// POST /api/jobs/:id/cancel — Annuler un job
router.post('/:id/cancel', async (req: AuthRequest, res: Response): Promise<void> => {
  const jobId = parseInt(req.params['id'] as string);

  try {
    const job = await prisma.jobTraitement.findFirst({
      where: { id: jobId, tenant_id: req.user!.tenantId },
    });
    if (!job) { res.status(404).json({ success: false, message: 'Job non trouvé' }); return; }
    if (job.statut === 'COMPLETE' || job.statut === 'ECHOUE') {
      res.status(400).json({ success: false, message: 'Ce job ne peut pas être annulé (terminé)' }); return;
    }

    // Annuler dans BullMQ
    if (job.bull_job_id) {
      const bullJob = await importQueue.getJob(job.bull_job_id);
      if (bullJob) await bullJob.remove();
    }

    await prisma.jobTraitement.update({
      where: { id: jobId },
      data: { statut: 'ANNULE', updated_by: req.user!.userId },
    });

    res.json({ success: true, message: 'Job annulé' });
  } catch {
    res.status(500).json({ success: false, message: 'Erreur lors de l\'annulation' });
  }
});

// POST /api/jobs/:id/resume — Reprendre un job depuis index_derniere_ligne
router.post('/:id/resume', async (req: AuthRequest, res: Response): Promise<void> => {
  const jobId = parseInt(req.params['id'] as string);

  try {
    const job = await prisma.jobTraitement.findFirst({
      where: { id: jobId, tenant_id: req.user!.tenantId },
      include: { fichiers_sources: true },
    });
    if (!job) { res.status(404).json({ success: false, message: 'Job non trouvé' }); return; }
    if (job.statut !== 'ECHOUE' && job.statut !== 'ANNULE') {
      res.status(400).json({ success: false, message: 'Seuls les jobs échoués ou annulés peuvent être repris' }); return;
    }

    const fichier = job.fichiers_sources[0];
    if (!fichier) { res.status(400).json({ success: false, message: 'Fichier source introuvable' }); return; }

    // Récupérer le compte_bancaire_id depuis les données du job (resultat JSON)
    const jobResultat = job.resultat as Record<string, unknown> | null;
    const compteId = jobResultat?.['compteId'] as number | undefined;

    if (!compteId) {
      res.status(400).json({ success: false, message: 'Impossible de déterminer le compte bancaire (données manquantes). Relancez un nouvel import.' });
      return;
    }

    await prisma.jobTraitement.update({
      where: { id: jobId },
      data: { statut: 'EN_ATTENTE', updated_by: req.user!.userId },
    });

    const bullJob = await importQueue.add(`resume-${jobId}`, {
      jobId,
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      filePath: `${process.env.UPLOAD_DIR || './uploads'}/${fichier.nom_stockage}`,
      compteId,
      resumeFromIndex: job.index_derniere_ligne,
    });

    await prisma.jobTraitement.update({
      where: { id: jobId },
      data: { bull_job_id: bullJob.id?.toString(), updated_by: req.user!.userId },
    });

    res.json({ success: true, message: `Job repris depuis la ligne ${job.index_derniere_ligne}`, data: { bullJobId: bullJob.id } });
  } catch {
    res.status(500).json({ success: false, message: 'Erreur lors de la reprise' });
  }
});

export default router;
