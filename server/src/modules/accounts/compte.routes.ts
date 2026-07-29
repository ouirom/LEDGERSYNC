import { Router, Response } from 'express';
import prisma from '../../config/db';
import { authenticate, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { entreprise_id } = req.query;
  try {
    const data = await prisma.compteBancaire.findMany({
      where: {
        entreprise: { tenant_id: req.user!.tenantId },
        etat: 'ACTIF',
        ...(entreprise_id ? { entreprise_id: parseInt(entreprise_id as string) } : {}),
      },
      include: { banque: true, entreprise: true },
    });
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { entreprise_id, banque_id, numero_compte, iban, intitule, devise, solde_initial } = req.body as Record<string, unknown>;
  try {
    const data = await prisma.compteBancaire.create({
      data: {
        entreprise_id: Number(entreprise_id),
        banque_id: Number(banque_id),
        numero_compte: String(numero_compte),
        iban: iban ? String(iban) : null,
        intitule: String(intitule),
        devise: devise ? String(devise) : 'XOF',
        solde_initial: solde_initial ? Number(solde_initial) : 0,
        etat: 'ACTIF',
        created_by: req.user!.userId,
        updated_by: req.user!.userId,
      },
    });
    res.status(201).json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

export default router;
