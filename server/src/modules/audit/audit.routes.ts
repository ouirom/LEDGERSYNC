import { Router, Response } from 'express';
import prisma from '../../config/db';
import { authenticate, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/audit?entite=X&page=1
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { entite, action, utilisateur_id, date_debut, date_fin, page = '1', limit = '50' } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  try {
    const where: Record<string, unknown> = { tenant_id: req.user!.tenantId };
    if (entite) where['entite'] = entite;
    if (action) where['action'] = action;
    if (utilisateur_id) where['utilisateur_id'] = parseInt(utilisateur_id as string);
    if (date_debut || date_fin) {
      where['created_at'] = {
        ...(date_debut ? { gte: new Date(date_debut as string) } : {}),
        ...(date_fin ? { lte: new Date(date_fin as string) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      prisma.logTraitement.findMany({
        where: where as any,
        skip,
        take: parseInt(limit as string),
        orderBy: { created_at: 'desc' },
      }),
      prisma.logTraitement.count({ where: where as any }),
    ]);

    res.json({ success: true, data, meta: { total, page: parseInt(page as string), limit: parseInt(limit as string) } });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

export default router;
