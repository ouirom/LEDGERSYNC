import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/db';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

const imputationSchema = z.object({
  code: z.string().min(1).max(20),
  libelle: z.string().min(2).max(200),
  type: z.enum(['DEBIT', 'CREDIT']),
  compte_imputation: z.string().max(20).optional(),
});

// GET /api/imputations — Catégories d'imputation du tenant (comptes dédiés aux écarts)
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await prisma.imputationCategorie.findMany({
      where: { tenant_id: req.user!.tenantId, etat: { not: 'ARCHIVE' } },
      orderBy: { libelle: 'asc' },
    });
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// POST /api/imputations — Créer une catégorie d'imputation
router.post('/', authorize('SUPER_ADMIN', 'ADMIN_TENANT', 'DAF'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = imputationSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }

  try {
    const data = await prisma.imputationCategorie.create({
      data: { ...parsed.data, tenant_id: req.user!.tenantId, etat: 'ACTIF', created_by: req.user!.userId, updated_by: req.user!.userId },
    });
    res.status(201).json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// PUT /api/imputations/:id — Mettre à jour une catégorie
router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN_TENANT', 'DAF'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = imputationSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const id = parseInt(req.params['id'] as string);

  const existing = await prisma.imputationCategorie.findFirst({ where: { id, tenant_id: req.user!.tenantId } });
  if (!existing) { res.status(404).json({ success: false, message: 'Catégorie non trouvée' }); return; }

  try {
    const data = await prisma.imputationCategorie.update({ where: { id }, data: { ...parsed.data, updated_by: req.user!.userId } });
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// DELETE /api/imputations/:id — Archiver une catégorie
router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN_TENANT', 'DAF'), async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'] as string);
  const existing = await prisma.imputationCategorie.findFirst({ where: { id, tenant_id: req.user!.tenantId } });
  if (!existing) { res.status(404).json({ success: false, message: 'Catégorie non trouvée' }); return; }

  try {
    const data = await prisma.imputationCategorie.update({ where: { id }, data: { etat: 'ARCHIVE', updated_by: req.user!.userId } });
    res.json({ success: true, data, message: 'Catégorie archivée' });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

export default router;
