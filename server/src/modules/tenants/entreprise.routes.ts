import { Router, Response } from 'express';
import prisma from '../../config/db';
import { authenticate, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await prisma.entreprise.findMany({
      where: { tenant_id: req.user!.tenantId, etat: { not: 'ARCHIVE' } },
      include: { pays: true, theme: true },
      orderBy: { nom: 'asc' },
    });
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { code, nom, pays_id, theme_id, siret, adresse } = req.body as Record<string, unknown>;
  try {
    const data = await prisma.entreprise.create({
      data: {
        tenant_id: req.user!.tenantId,
        code: String(code),
        nom: String(nom),
        pays_id: pays_id ? Number(pays_id) : null,
        theme_id: theme_id ? Number(theme_id) : null,
        siret: siret ? String(siret) : null,
        adresse: adresse ? String(adresse) : null,
        etat: 'ACTIF',
        created_by: req.user!.userId,
        updated_by: req.user!.userId,
      },
    });
    res.status(201).json({ success: true, data });
  } catch (err: any) {
    if (err.code === 'P2002') { res.status(409).json({ success: false, message: 'Code entreprise déjà utilisé dans ce tenant' }); return; }
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

export default router;
