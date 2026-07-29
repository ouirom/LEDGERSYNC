import { Router, Response } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { authenticate, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/audit?entite=X&page=1
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { entite, action, utilisateur_id, date_debut, date_fin, page = '1', limit = '50' } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  try {
    const where: Prisma.LogTraitementWhereInput = { tenant_id: req.user!.tenantId };
    if (entite) where.entite = entite as string;
    if (action) where.action = action as string;
    if (utilisateur_id) where.utilisateur_id = parseInt(utilisateur_id as string);
    if (date_debut || date_fin) {
      where.created_at = {
        ...(date_debut ? { gte: new Date(date_debut as string) } : {}),
        ...(date_fin ? { lte: new Date(date_fin as string) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      prisma.logTraitement.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { created_at: 'desc' },
      }),
      prisma.logTraitement.count({ where }),
    ]);

    res.json({ success: true, data, meta: { total, page: parseInt(page as string), limit: parseInt(limit as string) } });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// GET /api/audit/connexions?utilisateur_id=X&succes=true&page=1 — Journal des connexions (succès + échecs)
router.get('/connexions', async (req: AuthRequest, res: Response): Promise<void> => {
  const { utilisateur_id, succes, date_debut, date_fin, page = '1', limit = '50' } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  try {
    const where: Prisma.LogConnexionWhereInput = { utilisateur: { tenant_id: req.user!.tenantId } };
    if (utilisateur_id) where.utilisateur_id = parseInt(utilisateur_id as string);
    if (succes === 'true' || succes === 'false') where.succes = succes === 'true';
    if (date_debut || date_fin) {
      where.created_at = {
        ...(date_debut ? { gte: new Date(date_debut as string) } : {}),
        ...(date_fin ? { lte: new Date(date_fin as string) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      prisma.logConnexion.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { created_at: 'desc' },
        include: { utilisateur: { select: { id: true, nom: true, prenom: true, email: true } } },
      }),
      prisma.logConnexion.count({ where }),
    ]);

    res.json({ success: true, data, meta: { total, page: parseInt(page as string), limit: parseInt(limit as string) } });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

export default router;
