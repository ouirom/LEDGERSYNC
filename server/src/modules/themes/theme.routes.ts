import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/db';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadécimale invalide (ex: #0f3460)');

const themeSchema = z.object({
  nom: z.string().min(2).max(100),
  couleur_primaire: hexColor,
  couleur_secondaire: hexColor,
  couleur_accent: hexColor,
  mode_sombre: z.boolean().optional(),
  logo_url: z.string().optional(),
});

// GET /api/themes — Catalogue des thèmes disponibles (presets + personnalisés)
router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await prisma.theme.findMany({
      where: { etat: { not: 'ARCHIVE' } },
      orderBy: { created_at: 'asc' },
    });
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// POST /api/themes — Créer un thème personnalisé
router.post('/', authorize('SUPER_ADMIN', 'ADMIN_TENANT', 'DAF'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = themeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }

  try {
    const data = await prisma.theme.create({
      data: {
        ...parsed.data,
        mode_sombre: parsed.data.mode_sombre ?? false,
        etat: 'ACTIF',
        created_by: req.user!.userId,
        updated_by: req.user!.userId,
      },
    });
    res.status(201).json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

export default router;
