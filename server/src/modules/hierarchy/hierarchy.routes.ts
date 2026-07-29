import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/db';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { createAuditEntry } from '../../middleware/auditLogger';
import { isPrismaError } from '../../utils/errors';

const router = Router();
router.use(authenticate, authorize('SUPER_ADMIN', 'ADMIN_TENANT'));

const nomCodeSchema = z.object({
  nom: z.string().min(2).max(200),
  code: z.string().min(1).max(20),
});

// ============================================================
// SUCCURSALES
// ============================================================
const succursaleCreateSchema = nomCodeSchema.extend({ entreprise_id: z.number().int().positive() });

router.post('/succursales', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = succursaleCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }

  const entreprise = await prisma.entreprise.findFirst({
    where: { id: parsed.data.entreprise_id, tenant_id: req.user!.tenantId },
  });
  if (!entreprise) { res.status(404).json({ success: false, message: 'Entreprise non trouvée' }); return; }

  try {
    const data = await prisma.succursale.create({
      data: { ...parsed.data, etat: 'ACTIF', created_by: req.user!.userId, updated_by: req.user!.userId },
    });
    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'SUCCURSALE', entiteId: data.id, action: 'CREATE', apres: data, ipAddress: req.ip });
    res.status(201).json({ success: true, data });
  } catch (err) {
    if (isPrismaError(err, 'P2002')) { res.status(409).json({ success: false, message: 'Code succursale déjà utilisé' }); return; }
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

router.put('/succursales/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = nomCodeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const id = parseInt(req.params['id'] as string);

  const existing = await prisma.succursale.findFirst({ where: { id, entreprise: { tenant_id: req.user!.tenantId } } });
  if (!existing) { res.status(404).json({ success: false, message: 'Succursale non trouvée' }); return; }

  try {
    const data = await prisma.succursale.update({
      where: { id },
      data: { ...parsed.data, updated_by: req.user!.userId },
    });
    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'SUCCURSALE', entiteId: id, action: 'UPDATE', avant: existing, apres: data, ipAddress: req.ip });
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

router.delete('/succursales/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'] as string);
  const existing = await prisma.succursale.findFirst({ where: { id, entreprise: { tenant_id: req.user!.tenantId } } });
  if (!existing) { res.status(404).json({ success: false, message: 'Succursale non trouvée' }); return; }

  try {
    const data = await prisma.succursale.update({ where: { id }, data: { etat: 'ARCHIVE', updated_by: req.user!.userId } });
    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'SUCCURSALE', entiteId: id, action: 'DELETE', avant: existing, ipAddress: req.ip });
    res.json({ success: true, data, message: 'Succursale archivée' });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// ============================================================
// SOUS-SUCCURSALES
// ============================================================
const sousSuccursaleCreateSchema = nomCodeSchema.extend({ succursale_id: z.number().int().positive() });

router.post('/sous-succursales', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = sousSuccursaleCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }

  const succursale = await prisma.succursale.findFirst({
    where: { id: parsed.data.succursale_id, entreprise: { tenant_id: req.user!.tenantId } },
  });
  if (!succursale) { res.status(404).json({ success: false, message: 'Succursale non trouvée' }); return; }

  try {
    const data = await prisma.sousSuccursale.create({
      data: { ...parsed.data, etat: 'ACTIF', created_by: req.user!.userId, updated_by: req.user!.userId },
    });
    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'SOUS_SUCCURSALE', entiteId: data.id, action: 'CREATE', apres: data, ipAddress: req.ip });
    res.status(201).json({ success: true, data });
  } catch (err) {
    if (isPrismaError(err, 'P2002')) { res.status(409).json({ success: false, message: 'Code sous-succursale déjà utilisé' }); return; }
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

router.put('/sous-succursales/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = nomCodeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const id = parseInt(req.params['id'] as string);

  const existing = await prisma.sousSuccursale.findFirst({ where: { id, succursale: { entreprise: { tenant_id: req.user!.tenantId } } } });
  if (!existing) { res.status(404).json({ success: false, message: 'Sous-succursale non trouvée' }); return; }

  try {
    const data = await prisma.sousSuccursale.update({ where: { id }, data: { ...parsed.data, updated_by: req.user!.userId } });
    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'SOUS_SUCCURSALE', entiteId: id, action: 'UPDATE', avant: existing, apres: data, ipAddress: req.ip });
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

router.delete('/sous-succursales/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'] as string);
  const existing = await prisma.sousSuccursale.findFirst({ where: { id, succursale: { entreprise: { tenant_id: req.user!.tenantId } } } });
  if (!existing) { res.status(404).json({ success: false, message: 'Sous-succursale non trouvée' }); return; }

  try {
    const data = await prisma.sousSuccursale.update({ where: { id }, data: { etat: 'ARCHIVE', updated_by: req.user!.userId } });
    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'SOUS_SUCCURSALE', entiteId: id, action: 'DELETE', avant: existing, ipAddress: req.ip });
    res.json({ success: true, data, message: 'Sous-succursale archivée' });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// ============================================================
// DIRECTIONS
// ============================================================
const directionCreateSchema = nomCodeSchema.extend({ succursale_id: z.number().int().positive() });

router.post('/directions', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = directionCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }

  const succursale = await prisma.succursale.findFirst({
    where: { id: parsed.data.succursale_id, entreprise: { tenant_id: req.user!.tenantId } },
  });
  if (!succursale) { res.status(404).json({ success: false, message: 'Succursale non trouvée' }); return; }

  try {
    const data = await prisma.direction.create({
      data: { ...parsed.data, etat: 'ACTIF', created_by: req.user!.userId, updated_by: req.user!.userId },
    });
    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'DIRECTION', entiteId: data.id, action: 'CREATE', apres: data, ipAddress: req.ip });
    res.status(201).json({ success: true, data });
  } catch (err) {
    if (isPrismaError(err, 'P2002')) { res.status(409).json({ success: false, message: 'Code direction déjà utilisé' }); return; }
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

router.put('/directions/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = nomCodeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const id = parseInt(req.params['id'] as string);

  const existing = await prisma.direction.findFirst({ where: { id, succursale: { entreprise: { tenant_id: req.user!.tenantId } } } });
  if (!existing) { res.status(404).json({ success: false, message: 'Direction non trouvée' }); return; }

  try {
    const data = await prisma.direction.update({ where: { id }, data: { ...parsed.data, updated_by: req.user!.userId } });
    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'DIRECTION', entiteId: id, action: 'UPDATE', avant: existing, apres: data, ipAddress: req.ip });
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

router.delete('/directions/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'] as string);
  const existing = await prisma.direction.findFirst({ where: { id, succursale: { entreprise: { tenant_id: req.user!.tenantId } } } });
  if (!existing) { res.status(404).json({ success: false, message: 'Direction non trouvée' }); return; }

  try {
    const data = await prisma.direction.update({ where: { id }, data: { etat: 'ARCHIVE', updated_by: req.user!.userId } });
    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'DIRECTION', entiteId: id, action: 'DELETE', avant: existing, ipAddress: req.ip });
    res.json({ success: true, data, message: 'Direction archivée' });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// ============================================================
// SERVICES
// ============================================================
const serviceCreateSchema = nomCodeSchema.extend({ direction_id: z.number().int().positive() });

router.post('/services', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = serviceCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }

  const direction = await prisma.direction.findFirst({
    where: { id: parsed.data.direction_id, succursale: { entreprise: { tenant_id: req.user!.tenantId } } },
  });
  if (!direction) { res.status(404).json({ success: false, message: 'Direction non trouvée' }); return; }

  try {
    const data = await prisma.service.create({
      data: { ...parsed.data, etat: 'ACTIF', created_by: req.user!.userId, updated_by: req.user!.userId },
    });
    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'SERVICE', entiteId: data.id, action: 'CREATE', apres: data, ipAddress: req.ip });
    res.status(201).json({ success: true, data });
  } catch (err) {
    if (isPrismaError(err, 'P2002')) { res.status(409).json({ success: false, message: 'Code service déjà utilisé' }); return; }
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

router.put('/services/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = nomCodeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const id = parseInt(req.params['id'] as string);

  const existing = await prisma.service.findFirst({ where: { id, direction: { succursale: { entreprise: { tenant_id: req.user!.tenantId } } } } });
  if (!existing) { res.status(404).json({ success: false, message: 'Service non trouvé' }); return; }

  try {
    const data = await prisma.service.update({ where: { id }, data: { ...parsed.data, updated_by: req.user!.userId } });
    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'SERVICE', entiteId: id, action: 'UPDATE', avant: existing, apres: data, ipAddress: req.ip });
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

router.delete('/services/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'] as string);
  const existing = await prisma.service.findFirst({ where: { id, direction: { succursale: { entreprise: { tenant_id: req.user!.tenantId } } } } });
  if (!existing) { res.status(404).json({ success: false, message: 'Service non trouvé' }); return; }

  try {
    const data = await prisma.service.update({ where: { id }, data: { etat: 'ARCHIVE', updated_by: req.user!.userId } });
    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'SERVICE', entiteId: id, action: 'DELETE', avant: existing, ipAddress: req.ip });
    res.json({ success: true, data, message: 'Service archivé' });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

export default router;
