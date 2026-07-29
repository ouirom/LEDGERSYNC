import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/db';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

const periodeSchema = z.object({
  entreprise_id: z.number().int().positive(),
  mois: z.number().int().min(1).max(12),
  annee: z.number().int().min(2000).max(2100),
});

// GET /api/periods?entreprise_id=X&annee=Y
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { entreprise_id, annee } = req.query;
  try {
    const periodes = await prisma.periodeComptable.findMany({
      where: {
        entreprise: { tenant_id: req.user!.tenantId },
        ...(entreprise_id ? { entreprise_id: parseInt(entreprise_id as string) } : {}),
        ...(annee ? { annee: parseInt(annee as string) } : {}),
      },
      orderBy: [{ annee: 'desc' }, { mois: 'desc' }],
    });
    res.json({ success: true, data: periodes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

// POST /api/periods
router.post('/', authorize('ADMIN_TENANT', 'DAF', 'MANAGER', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = periodeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }

  try {
    const periode = await prisma.periodeComptable.create({
      data: { ...parsed.data, statut: 'OUVERT', created_by: req.user!.userId, updated_by: req.user!.userId },
    });
    res.status(201).json({ success: true, data: periode });
  } catch (err: any) {
    if (err.code === 'P2002') { res.status(409).json({ success: false, message: 'Période déjà existante' }); return; }
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

// PATCH /api/periods/:id/lock
router.patch('/:id/lock', authorize('DAF', 'MANAGER', 'SUPER_ADMIN', 'ADMIN_TENANT'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { statut } = req.body as { statut: 'OUVERT' | 'VERROUILLE' | 'CLOS' };
  if (!['OUVERT', 'VERROUILLE', 'CLOS'].includes(statut)) {
    res.status(400).json({ success: false, message: 'Statut invalide' }); return;
  }

  try {
    const periode = await prisma.periodeComptable.update({
      where: { id: parseInt(req.params['id'] as string) },
      data: {
        statut,
        date_cloture: statut === 'CLOS' ? new Date() : null,
        clos_par: statut === 'CLOS' ? req.user!.userId : null,
        updated_by: req.user!.userId,
      },
    });
    res.json({ success: true, data: periode });
  } catch {
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

export default router;
