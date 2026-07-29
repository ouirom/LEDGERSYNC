import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/db';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate, authorize('SUPER_ADMIN', 'ADMIN_TENANT'));

// GET /api/tenants
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenants = await prisma.tenant.findMany({ include: { theme: true }, orderBy: { created_at: 'desc' } });
    res.json({ success: true, data: tenants });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// POST /api/tenants
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({ code: z.string().min(2).max(20), nom: z.string().min(2), plan: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  try {
    const tenant = await prisma.tenant.create({ data: { ...parsed.data, etat: 'ACTIF', created_by: req.user!.userId, updated_by: req.user!.userId } });
    res.status(201).json({ success: true, data: tenant });
  } catch (err: any) {
    if (err.code === 'P2002') { res.status(409).json({ success: false, message: 'Code tenant déjà utilisé' }); return; }
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

export default router;
