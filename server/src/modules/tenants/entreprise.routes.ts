import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/db';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { createAuditEntry } from '../../middleware/auditLogger';
import { isPrismaError } from '../../utils/errors';

const router = Router();
router.use(authenticate);

const entrepriseCreateSchema = z.object({
  code: z.string().min(1).max(20),
  nom: z.string().min(1).max(200),
  pays_id: z.number().int().positive().nullable().optional(),
  theme_id: z.number().int().positive().nullable().optional(),
  siret: z.string().max(50).nullable().optional(),
  adresse: z.string().nullable().optional(),
});

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await prisma.entreprise.findMany({
      where: { tenant_id: req.user!.tenantId, etat: { not: 'ARCHIVE' } },
      include: {
        pays: true,
        theme: true,
        succursales: {
          where: { etat: { not: 'ARCHIVE' } },
          include: {
            sous_succursales: { where: { etat: { not: 'ARCHIVE' } } },
            directions: {
              where: { etat: { not: 'ARCHIVE' } },
              include: { services: { where: { etat: { not: 'ARCHIVE' } } } },
            },
          },
        },
      },
      orderBy: { nom: 'asc' },
    });
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

router.post('/', authorize('SUPER_ADMIN', 'ADMIN_TENANT'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = entrepriseCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const { code, nom, pays_id, theme_id, siret, adresse } = parsed.data;

  try {
    const data = await prisma.entreprise.create({
      data: {
        tenant_id: req.user!.tenantId,
        code,
        nom,
        pays_id: pays_id ?? null,
        theme_id: theme_id ?? null,
        siret: siret ?? null,
        adresse: adresse ?? null,
        etat: 'ACTIF',
        created_by: req.user!.userId,
        updated_by: req.user!.userId,
      },
      include: { pays: true, theme: true },
    });
    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'ENTREPRISE', entiteId: data.id, action: 'CREATE', apres: { code, nom, pays_id, siret }, ipAddress: req.ip });
    res.status(201).json({ success: true, data });
  } catch (err) {
    if (isPrismaError(err, 'P2002')) { res.status(409).json({ success: false, message: 'Code entreprise déjà utilisé dans ce tenant' }); return; }
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

// PATCH /api/entreprises/:id/theme — Assigner un thème à l'entreprise (injection dynamique des couleurs)
router.patch('/:id/theme', authorize('SUPER_ADMIN', 'ADMIN_TENANT', 'DAF'), async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'] as string);
  const { theme_id } = req.body as { theme_id: number };
  if (!theme_id) { res.status(400).json({ success: false, message: 'theme_id requis' }); return; }

  const existing = await prisma.entreprise.findFirst({ where: { id, tenant_id: req.user!.tenantId } });
  if (!existing) { res.status(404).json({ success: false, message: 'Entreprise non trouvée' }); return; }

  const theme = await prisma.theme.findFirst({ where: { id: theme_id, etat: { not: 'ARCHIVE' } } });
  if (!theme) { res.status(404).json({ success: false, message: 'Thème non trouvé' }); return; }

  try {
    const data = await prisma.entreprise.update({
      where: { id },
      data: { theme_id, updated_by: req.user!.userId },
      include: { theme: true },
    });
    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'ENTREPRISE_THEME', entiteId: id, action: 'UPDATE', avant: { theme_id: existing.theme_id }, apres: { theme_id }, ipAddress: req.ip });
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

export default router;
