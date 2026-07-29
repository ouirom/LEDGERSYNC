import { Router, Response } from 'express';
import prisma from '../../config/db';
import { authenticate, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/pays — Référentiel des pays (données globales, non liées au tenant)
router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await prisma.pays.findMany({ where: { etat: { not: 'ARCHIVE' } }, orderBy: { nom: 'asc' } });
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

export default router;
