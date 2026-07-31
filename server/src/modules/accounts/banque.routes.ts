import { Router, Response } from 'express';
import prisma from '../../config/db';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { resolveOrgScope, banqueScopeWhere } from '../../utils/orgScope';

const router = Router();
router.use(authenticate);

// GET /api/banques — Liste des banques visibles dans le périmètre de l'utilisateur
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const scope = await resolveOrgScope(req.user!);
    const data = await prisma.banque.findMany({
      where: { tenant_id: req.user!.tenantId, etat: 'ACTIF', ...banqueScopeWhere(scope) },
      include: { templates: true },
    });
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// POST /api/banques — Créer une banque, rattachée au périmètre de l'utilisateur
// (entreprise/succursale explicite en body si son rôle n'est pas restreint,
// sinon héritée automatiquement de son propre rattachement).
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { code_swift, nom, pays_code, entreprise_id, succursale_id, sous_succursale_id } = req.body as Record<string, unknown>;
  try {
    const scope = await resolveOrgScope(req.user!);
    const rattachement = scope.unrestricted
      ? {
          entreprise_id: entreprise_id ? Number(entreprise_id) : null,
          succursale_id: succursale_id ? Number(succursale_id) : null,
          sous_succursale_id: sous_succursale_id ? Number(sous_succursale_id) : null,
        }
      : { entreprise_id: scope.entrepriseId, succursale_id: scope.succursaleId, sous_succursale_id: scope.sousSuccursaleId };

    const data = await prisma.banque.create({
      data: {
        tenant_id: req.user!.tenantId,
        entreprise_id: rattachement.entreprise_id,
        succursale_id: rattachement.succursale_id,
        sous_succursale_id: rattachement.sous_succursale_id,
        code_swift: code_swift as string, nom: nom as string, pays_code: pays_code as string,
        etat: 'ACTIF', created_by: req.user!.userId, updated_by: req.user!.userId,
      },
    });
    res.status(201).json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// GET /api/banques/templates — Templates de relevé
router.get('/templates', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await prisma.banqueReleveTemplate.findMany({
      where: { banque: { tenant_id: req.user!.tenantId }, etat: { not: 'ARCHIVE' } },
      include: { banque: { select: { id: true, nom: true } } },
    });
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// POST /api/banques/templates — Créer un template
router.post('/templates', async (req: AuthRequest, res: Response): Promise<void> => {
  const { banque_id, nom, mapping_colonnes, ligne_entete, format_date, separateur } = req.body as Record<string, unknown>;
  try {
    const data = await prisma.banqueReleveTemplate.create({
      data: {
        banque_id: Number(banque_id),
        nom: String(nom),
        mapping_colonnes: mapping_colonnes as object,
        ligne_entete: ligne_entete ? Number(ligne_entete) : 1,
        format_date: String(format_date || 'DD/MM/YYYY'),
        separateur: separateur ? String(separateur) : null,
        etat: 'ACTIF',
        created_by: req.user!.userId,
        updated_by: req.user!.userId,
      },
    });
    res.status(201).json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

// PUT /api/banques/templates/:id — Mettre à jour un template
router.put('/templates/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const { nom, mapping_colonnes, ligne_entete, format_date } = req.body as Record<string, unknown>;
  const id = parseInt(req.params['id'] as string);
  try {
    const existing = await prisma.banqueReleveTemplate.findFirst({
      where: { id, banque: { tenant_id: req.user!.tenantId } },
    });
    if (!existing) { res.status(404).json({ success: false, message: 'Template non trouvé' }); return; }

    const data = await prisma.banqueReleveTemplate.update({
      where: { id },
      data: {
        nom: String(nom),
        mapping_colonnes: mapping_colonnes as object,
        ligne_entete: Number(ligne_entete),
        format_date: String(format_date),
        updated_by: req.user!.userId,
      },
    });
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// DELETE /api/banques/templates/:id — Supprimer un template (soft delete)
router.delete('/templates/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'] as string);
  try {
    const existing = await prisma.banqueReleveTemplate.findFirst({
      where: { id, banque: { tenant_id: req.user!.tenantId } },
    });
    if (!existing) { res.status(404).json({ success: false, message: 'Template non trouvé' }); return; }

    await prisma.banqueReleveTemplate.update({
      where: { id },
      data: { etat: 'ARCHIVE', updated_by: req.user!.userId },
    });
    res.json({ success: true, message: 'Template supprimé' });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

export default router;
