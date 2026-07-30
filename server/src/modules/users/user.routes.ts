import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import type { RoleUtilisateur } from '@prisma/client';
import prisma from '../../config/db';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { createAuditEntry } from '../../middleware/auditLogger';
import { isPrismaError, errorMessage } from '../../utils/errors';
import { sendAccountCreatedEmail } from '../../utils/mailer';

const router = Router();
router.use(authenticate, authorize('SUPER_ADMIN', 'ADMIN_TENANT'));

const ROLES = ['SUPER_ADMIN', 'ADMIN_TENANT', 'DAF', 'MANAGER', 'SUPERVISEUR', 'USER', 'AUDITEUR'] as const;
// Séparation des fonctions : un ADMIN_TENANT ne peut pas se créer de pairs ni de super-admin,
// seul un SUPER_ADMIN peut attribuer ces deux rôles (évite l'auto-élévation de privilèges).
const ROLES_RESERVED_TO_SUPER_ADMIN: RoleUtilisateur[] = ['SUPER_ADMIN', 'ADMIN_TENANT'];

function canAssignRole(actorRole: string, targetRole: RoleUtilisateur): boolean {
  return actorRole === 'SUPER_ADMIN' || !ROLES_RESERVED_TO_SUPER_ADMIN.includes(targetRole);
}

const userSelect = {
  id: true, email: true, nom: true, prenom: true, role: true, etat: true, derniere_connexion: true,
  entreprise_id: true, service_id: true,
  entreprise: { select: { id: true, nom: true, code: true } },
  service: { select: { id: true, nom: true, direction: { select: { id: true, nom: true, succursale: { select: { id: true, nom: true } } } } } },
} as const;

const baseSchema = z.object({
  nom: z.string().min(1).max(100),
  prenom: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(ROLES),
  entreprise_id: z.number().int().positive().nullable().optional(),
  service_id: z.number().int().positive().nullable().optional(),
});

const createSchema = baseSchema.extend({ password: z.string().min(6).max(100) });
const updateSchema = baseSchema.extend({ etat: z.enum(['ACTIF', 'INACTIF', 'SUSPENDU']).optional() });
const passwordSchema = z.object({ password: z.string().min(6).max(100) });

// Vérifie que l'entreprise (et, le cas échéant, le service — via sa chaîne
// service -> direction -> succursale -> entreprise) appartiennent bien au tenant
// courant, et que le service appartient bien à l'entreprise choisie.
async function validateAffectation(
  tenantId: number,
  entrepriseId: number | null | undefined,
  serviceId: number | null | undefined
): Promise<string | null> {
  if (entrepriseId) {
    const entreprise = await prisma.entreprise.findFirst({ where: { id: entrepriseId, tenant_id: tenantId } });
    if (!entreprise) return 'Entreprise non trouvée';
  }
  if (serviceId) {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, direction: { succursale: { entreprise: { tenant_id: tenantId } } } },
      include: { direction: { include: { succursale: true } } },
    });
    if (!service) return 'Service non trouvé';
    if (entrepriseId && service.direction.succursale.entreprise_id !== entrepriseId) {
      return 'Le service sélectionné n\'appartient pas à l\'entreprise choisie';
    }
  }
  return null;
}

// GET /api/users — Lister les utilisateurs du tenant
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { page = '1', limit = '100' } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  try {
    const where = { tenant_id: req.user!.tenantId, etat: { not: 'ARCHIVE' as const } };
    const [data, total] = await Promise.all([
      prisma.utilisateur.findMany({ where, select: userSelect, orderBy: { nom: 'asc' }, skip, take: parseInt(limit as string) }),
      prisma.utilisateur.count({ where }),
    ]);
    res.json({ success: true, data, meta: { total } });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// POST /api/users — Créer un utilisateur
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const { nom, prenom, email, role, entreprise_id, service_id, password } = parsed.data;

  if (!canAssignRole(req.user!.role, role)) {
    res.status(403).json({ success: false, message: 'Rôle insuffisant pour attribuer ce niveau d\'accès' }); return;
  }
  const affectationError = await validateAffectation(req.user!.tenantId, entreprise_id, service_id);
  if (affectationError) { res.status(404).json({ success: false, message: affectationError }); return; }

  try {
    const password_hash = await bcrypt.hash(password, 12);
    const data = await prisma.utilisateur.create({
      data: {
        tenant_id: req.user!.tenantId, nom, prenom, email, role, password_hash,
        entreprise_id: entreprise_id ?? null, service_id: service_id ?? null,
        etat: 'ACTIF', must_change_password: true, created_by: req.user!.userId, updated_by: req.user!.userId,
      },
      select: userSelect,
    });
    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'UTILISATEUR', entiteId: data.id, action: 'CREATE', apres: { email, nom, prenom, role }, ipAddress: req.ip });
    // Notification par email : ne bloque pas la réponse et n'échoue jamais la création
    // (sendAccountCreatedEmail avale ses propres erreurs, voir mailer.ts).
    void sendAccountCreatedEmail({ to: email, prenom, nom, role, entreprise: data.entreprise?.nom });
    res.status(201).json({ success: true, data });
  } catch (err) {
    if (isPrismaError(err, 'P2002')) { res.status(409).json({ success: false, message: 'Cet email est déjà utilisé dans ce tenant' }); return; }
    res.status(500).json({ success: false, message: errorMessage(err) });
  }
});

// PUT /api/users/:id — Mettre à jour un utilisateur
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const id = parseInt(req.params['id'] as string);
  const { nom, prenom, email, role, entreprise_id, service_id, etat } = parsed.data;

  const existing = await prisma.utilisateur.findFirst({ where: { id, tenant_id: req.user!.tenantId } });
  if (!existing) { res.status(404).json({ success: false, message: 'Utilisateur non trouvé' }); return; }
  if (!canAssignRole(req.user!.role, role)) {
    res.status(403).json({ success: false, message: 'Rôle insuffisant pour attribuer ce niveau d\'accès' }); return;
  }
  if (id === req.user!.userId && etat && etat !== 'ACTIF') {
    res.status(400).json({ success: false, message: 'Vous ne pouvez pas suspendre votre propre compte' }); return;
  }
  const affectationError = await validateAffectation(req.user!.tenantId, entreprise_id, service_id);
  if (affectationError) { res.status(404).json({ success: false, message: affectationError }); return; }

  try {
    const data = await prisma.utilisateur.update({
      where: { id },
      data: {
        nom, prenom, email, role,
        entreprise_id: entreprise_id ?? null, service_id: service_id ?? null,
        ...(etat ? { etat } : {}),
        updated_by: req.user!.userId,
      },
      select: userSelect,
    });
    await createAuditEntry({
      tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'UTILISATEUR', entiteId: id, action: 'UPDATE',
      avant: { nom: existing.nom, prenom: existing.prenom, email: existing.email, role: existing.role, etat: existing.etat },
      apres: { nom, prenom, email, role, etat: data.etat }, ipAddress: req.ip,
    });
    res.json({ success: true, data });
  } catch (err) {
    if (isPrismaError(err, 'P2002')) { res.status(409).json({ success: false, message: 'Cet email est déjà utilisé dans ce tenant' }); return; }
    res.status(500).json({ success: false, message: errorMessage(err) });
  }
});

// PATCH /api/users/:id/reset-password — Réinitialiser le mot de passe (invalide la session en cours)
router.patch('/:id/reset-password', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const id = parseInt(req.params['id'] as string);

  const existing = await prisma.utilisateur.findFirst({ where: { id, tenant_id: req.user!.tenantId } });
  if (!existing) { res.status(404).json({ success: false, message: 'Utilisateur non trouvé' }); return; }

  try {
    const password_hash = await bcrypt.hash(parsed.data.password, 12);
    await prisma.utilisateur.update({ where: { id }, data: { password_hash, must_change_password: true, refresh_token: null, updated_by: req.user!.userId } });
    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'UTILISATEUR', entiteId: id, action: 'RESET_PASSWORD', ipAddress: req.ip });
    res.json({ success: true, message: 'Mot de passe réinitialisé' });
  } catch (err) {
    res.status(500).json({ success: false, message: errorMessage(err) });
  }
});

// DELETE /api/users/:id — Archiver un utilisateur (soft delete + invalidation de session)
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'] as string);
  if (id === req.user!.userId) {
    res.status(400).json({ success: false, message: 'Vous ne pouvez pas archiver votre propre compte' }); return;
  }
  const existing = await prisma.utilisateur.findFirst({ where: { id, tenant_id: req.user!.tenantId } });
  if (!existing) { res.status(404).json({ success: false, message: 'Utilisateur non trouvé' }); return; }

  try {
    await prisma.utilisateur.update({ where: { id }, data: { etat: 'ARCHIVE', refresh_token: null, updated_by: req.user!.userId } });
    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'UTILISATEUR', entiteId: id, action: 'DELETE', avant: { email: existing.email }, ipAddress: req.ip });
    res.json({ success: true, message: 'Utilisateur archivé' });
  } catch (err) {
    res.status(500).json({ success: false, message: errorMessage(err) });
  }
});

export default router;
