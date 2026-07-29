import { Router, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { authenticate, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

const ecritureSchema = z.object({
  entreprise_id: z.number().int().positive(),
  compte_bancaire_id: z.number().int().positive().optional(),
  reference: z.string().min(1),
  libelle: z.string().min(1),
  montant: z.number().positive(),
  type: z.enum(['DEBIT', 'CREDIT']),
  date_ecriture: z.string(),
  date_valeur: z.string().optional(),
  piece_ref: z.string().optional(),
  periode_mois: z.number().int().min(1).max(12),
  periode_annee: z.number().int().min(2000),
});

// GET /api/ecritures
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { compte_bancaire_id, mois, annee, lettree, page = '1' } = req.query;
  const skip = (parseInt(page as string) - 1) * 100;
  try {
    const where: Prisma.EcritureComptableWhereInput = {
      entreprise: { tenant_id: req.user!.tenantId },
      etat: { not: 'ANNULE' },
    };
    if (compte_bancaire_id) where.compte_bancaire_id = parseInt(compte_bancaire_id as string);
    if (mois) where.periode_mois = parseInt(mois as string);
    if (annee) where.periode_annee = parseInt(annee as string);
    if (lettree !== undefined) where.lettree = lettree === 'true';

    const [data, total] = await Promise.all([
      prisma.ecritureComptable.findMany({ where, skip, take: 100, orderBy: { date_ecriture: 'asc' } }),
      prisma.ecritureComptable.count({ where }),
    ]);
    res.json({ success: true, data, meta: { total, page: parseInt(page as string) } });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// POST /api/ecritures
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = ecritureSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }

  // Vérifier période
  const periode = await prisma.periodeComptable.findUnique({
    where: { entreprise_id_mois_annee: { entreprise_id: parsed.data.entreprise_id, mois: parsed.data.periode_mois, annee: parsed.data.periode_annee } },
  });
  if (periode && (periode.statut === 'VERROUILLE' || periode.statut === 'CLOS')) {
    res.status(423).json({ success: false, message: 'Période verrouillée', code: 'PERIOD_LOCKED' }); return;
  }

  try {
    const data = await prisma.ecritureComptable.create({
      data: {
        ...parsed.data,
        date_ecriture: new Date(parsed.data.date_ecriture),
        date_valeur: parsed.data.date_valeur ? new Date(parsed.data.date_valeur) : null,
        etat: 'BROUILLON',
        created_by: req.user!.userId,
        updated_by: req.user!.userId,
      },
    });
    res.status(201).json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// POST /api/ecritures/:id/extourne — Soft delete (extourne)
router.post('/:id/extourne', async (req: AuthRequest, res: Response): Promise<void> => {
  const { motif } = req.body as { motif: string };
  if (!motif || motif.trim().length < 5) {
    res.status(400).json({ success: false, message: 'Motif d\'extourne obligatoire (min. 5 caractères)' }); return;
  }

  const id = parseInt(req.params['id'] as string);
  try {
    const ecriture = await prisma.ecritureComptable.findFirst({
      where: { id, entreprise: { tenant_id: req.user!.tenantId } },
    });
    if (!ecriture) { res.status(404).json({ success: false, message: 'Écriture non trouvée' }); return; }
    if (ecriture.etat === 'ANNULE') { res.status(400).json({ success: false, message: 'Écriture déjà annulée' }); return; }

    // Créer l'écriture d'extourne (contre-passation)
    const extourne = await prisma.$transaction(async (tx) => {
      await tx.ecritureComptable.update({
        where: { id },
        data: { etat: 'ANNULE', motif_annulation: motif, updated_by: req.user!.userId },
      });
      return tx.ecritureComptable.create({
        data: {
          entreprise_id: ecriture.entreprise_id,
          compte_bancaire_id: ecriture.compte_bancaire_id,
          reference: `EXT-${ecriture.reference}`,
          libelle: `EXTOURNE: ${ecriture.libelle}`,
          montant: ecriture.montant,
          type: ecriture.type === 'DEBIT' ? 'CREDIT' : 'DEBIT',
          date_ecriture: new Date(),
          periode_mois: ecriture.periode_mois,
          periode_annee: ecriture.periode_annee,
          extourne_de: id,
          motif_annulation: motif,
          etat: 'VALIDE',
          created_by: req.user!.userId,
          updated_by: req.user!.userId,
        },
      });
    });

    res.status(201).json({ success: true, data: extourne, message: 'Extourne créée avec succès' });
  } catch { res.status(500).json({ success: false, message: 'Erreur lors de l\'extourne' }); }
});

export default router;
