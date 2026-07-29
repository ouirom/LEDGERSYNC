import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/db';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { createAuditEntry } from '../../middleware/auditLogger';
import { getIO } from '../../sockets/socketServer';

const router = Router();
router.use(authenticate);

const lettrageSchema = z.object({
  ecriture_ids: z.array(z.number().int().positive()).min(1),
  releve_ids: z.array(z.number().int().positive()).min(1),
  entreprise_id: z.number().int().positive(),
  compte_bancaire_id: z.number().int().positive(),
  periode_mois: z.number().int().min(1).max(12),
  periode_annee: z.number().int().min(2000),
  motif: z.string().optional(),
});

const ecartSchema = z.object({
  ecriture_ids: z.array(z.number().int().positive()),
  releve_ids: z.array(z.number().int().positive()),
  entreprise_id: z.number().int().positive(),
  compte_bancaire_id: z.number().int().positive(),
  periode_mois: z.number().int().min(1).max(12),
  periode_annee: z.number().int().min(2000),
  montant_ecart: z.number(),
  imputation_categorie_id: z.number().int().positive(),
  motif: z.string().min(1),
});

// ── GET /api/reconciliation/workspace ──────────────────────
router.get('/workspace', async (req: AuthRequest, res: Response): Promise<void> => {
  const { compte_bancaire_id, mois, annee } = req.query;
  if (!compte_bancaire_id || !mois || !annee) {
    res.status(400).json({ success: false, message: 'compte_bancaire_id, mois, annee requis' }); return;
  }

  const compteId = parseInt(compte_bancaire_id as string);
  const m = parseInt(mois as string);
  const a = parseInt(annee as string);

  try {
    const [ecritures, releves, rapprochement] = await Promise.all([
      prisma.ecritureComptable.findMany({
        where: {
          entreprise: { tenant_id: req.user!.tenantId },
          compte_bancaire_id: compteId,
          periode_mois: m,
          periode_annee: a,
          etat: { not: 'ANNULE' },
        },
        orderBy: { date_ecriture: 'asc' },
      }),
      prisma.releveBancaireLigne.findMany({
        where: {
          compte_bancaire_id: compteId,
          date_operation: {
            gte: new Date(a, m - 1, 1),
            lt: new Date(a, m, 1),
          },
          etat: { not: 'ANNULE' },
        },
        orderBy: { date_operation: 'asc' },
      }),
      prisma.rapprochement.findFirst({
        where: {
          compte_bancaire_id: compteId,
          periode_mois: m,
          periode_annee: a,
          entreprise: { tenant_id: req.user!.tenantId },
        },
      }),
    ]);

    res.json({ success: true, data: { ecritures, releves, rapprochement } });
  } catch (err) {
    console.error('[RECONCILIATION/WORKSPACE]', err);
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

// ── POST /api/reconciliation/lettrage ──────────────────────
// Opération de lettrage ACID avec dual-control check
router.post('/lettrage', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = lettrageSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }

  const { ecriture_ids, releve_ids, entreprise_id, compte_bancaire_id, periode_mois, periode_annee, motif } = parsed.data;

  // Vérifier verrouillage de période
  const periode = await prisma.periodeComptable.findUnique({
    where: { entreprise_id_mois_annee: { entreprise_id, mois: periode_mois, annee: periode_annee } },
  });
  if (periode && (periode.statut === 'VERROUILLE' || periode.statut === 'CLOS')) {
    res.status(423).json({ success: false, message: `Période ${periode_mois}/${periode_annee} verrouillée`, code: 'PERIOD_LOCKED' });
    return;
  }

  const lettrageRef = `LTR-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  try {
    // Transaction ACID
    const result = await prisma.$transaction(async (tx) => {
      // Lock rows for update (via findMany with explicit select)
      const ecritures = await tx.ecritureComptable.findMany({
        where: { id: { in: ecriture_ids }, lettree: false, etat: { not: 'ANNULE' } },
      });

      const releves = await tx.releveBancaireLigne.findMany({
        where: { id: { in: releve_ids }, lettree: false, etat: { not: 'ANNULE' } },
      });

      if (ecritures.length !== ecriture_ids.length || releves.length !== releve_ids.length) {
        throw new Error('Certaines écritures ou lignes de relevé sont déjà lettrées ou introuvables');
      }

      // Lettrage des écritures
      await tx.ecritureComptable.updateMany({
        where: { id: { in: ecriture_ids } },
        data: { lettree: true, lettrage_ref: lettrageRef, updated_by: req.user!.userId },
      });

      // Lettrage des lignes de relevé
      await tx.releveBancaireLigne.updateMany({
        where: { id: { in: releve_ids } },
        data: { lettree: true, lettrage_ref: lettrageRef, updated_by: req.user!.userId },
      });

      return { lettrageRef, ecrituresLettrees: ecritures.length, relevesLettres: releves.length };
    });

    // Audit log
    await createAuditEntry({
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      entite: 'LETTRAGE',
      action: 'CREATE',
      apres: { lettrageRef, ecriture_ids, releve_ids, motif },
      ipAddress: req.ip,
    });

    // Notifier via WebSocket
    const io = getIO();
    io.to(`tenant-${req.user!.tenantId}`).emit('lettrage:created', {
      lettrageRef,
      compteId: compte_bancaire_id,
      periode: { mois: periode_mois, annee: periode_annee },
    });

    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    res.status(422).json({ success: false, message: err.message || 'Erreur lors du lettrage' });
  }
});

// ── DELETE /api/reconciliation/lettrage/:ref ────────────────
// Dé-lettrage (soft) avec motif obligatoire
router.delete('/lettrage/:ref', async (req: AuthRequest, res: Response): Promise<void> => {
  const { motif } = req.body as { motif: string };
  if (!motif || motif.trim().length < 5) {
    res.status(400).json({ success: false, message: 'Motif de dé-lettrage obligatoire (min. 5 caractères)' }); return;
  }

  const ref = req.params['ref'] as string;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.ecritureComptable.updateMany({
        where: { lettrage_ref: ref },
        data: { lettree: false, lettrage_ref: null, motif_annulation: motif, updated_by: req.user!.userId },
      });
      await tx.releveBancaireLigne.updateMany({
        where: { lettrage_ref: ref },
        data: { lettree: false, lettrage_ref: null, updated_by: req.user!.userId },
      });
    });

    await createAuditEntry({
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      entite: 'LETTRAGE',
      action: 'DELETE',
      avant: { lettrageRef: ref },
      motif,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Dé-lettrage effectué avec succès' });
  } catch {
    res.status(500).json({ success: false, message: 'Erreur lors du dé-lettrage' });
  }
});

// ── POST /api/reconciliation/auto-match ────────────────────
// Matching automatique (montant + date ± N jours + référence)
router.post('/auto-match', async (req: AuthRequest, res: Response): Promise<void> => {
  const { compte_bancaire_id, periode_mois, periode_annee, tolerance_montant, tolerance_jours } = req.body as {
    compte_bancaire_id: number;
    periode_mois: number;
    periode_annee: number;
    tolerance_montant?: number;
    tolerance_jours?: number;
  };

  const tolMontant = tolerance_montant ?? parseFloat(process.env.MICRO_ECART_SEUIL || '0.05');
  const tolJours = tolerance_jours ?? 3;

  try {
    const ecritures = await prisma.ecritureComptable.findMany({
      where: {
        compte_bancaire_id,
        periode_mois,
        periode_annee,
        lettree: false,
        etat: { not: 'ANNULE' },
        entreprise: { tenant_id: req.user!.tenantId },
      },
    });

    const releves = await prisma.releveBancaireLigne.findMany({
      where: {
        compte_bancaire_id,
        lettree: false,
        etat: { not: 'ANNULE' },
        date_operation: {
          gte: new Date(periode_annee, periode_mois - 1, 1),
          lt: new Date(periode_annee, periode_mois, 1),
        },
      },
    });

    const suggestions: Array<{ ecriture_id: number; releve_id: number; score: number; montant_ecart: number }> = [];
    const usedReleves = new Set<number>();

    for (const ecriture of ecritures) {
      let bestMatch: typeof suggestions[0] | null = null;
      let bestScore = 0;

      for (const releve of releves) {
        if (usedReleves.has(releve.id)) continue;
        if (ecriture.type !== releve.type) continue;

        const montantDiff = Math.abs(Number(ecriture.montant) - Number(releve.montant));
        if (montantDiff > tolMontant + Math.abs(Number(ecriture.montant)) * 0.001) continue;

        const dateDiff = Math.abs((ecriture.date_ecriture.getTime() - releve.date_operation.getTime()) / 86400000);
        if (dateDiff > tolJours) continue;

        let score = 100 - dateDiff * 5 - montantDiff * 10;
        if (ecriture.reference && releve.reference && ecriture.reference === releve.reference) score += 50;

        if (score > bestScore) {
          bestScore = score;
          bestMatch = { ecriture_id: ecriture.id, releve_id: releve.id, score, montant_ecart: Number(ecriture.montant) - Number(releve.montant) };
        }
      }

      if (bestMatch) {
        suggestions.push(bestMatch);
        usedReleves.add(bestMatch.releve_id);
      }
    }

    res.json({ success: true, data: { suggestions, totalEcritures: ecritures.length, totalReleves: releves.length } });
  } catch (err) {
    console.error('[AUTO-MATCH]', err);
    res.status(500).json({ success: false, message: 'Erreur lors du matching automatique' });
  }
});

// ── POST /api/reconciliation/submit ────────────────────────
// Soumettre le rapprochement pour validation dual-control
router.post('/submit', async (req: AuthRequest, res: Response): Promise<void> => {
  const { rapprochement_id } = req.body as { rapprochement_id: number };

  try {
    const rapprochement = await prisma.rapprochement.findUnique({ where: { id: rapprochement_id } });
    if (!rapprochement) { res.status(404).json({ success: false, message: 'Rapprochement non trouvé' }); return; }

    // Dual-control: le créateur ne peut pas valider
    if (rapprochement.created_by === req.user!.userId) {
      res.status(403).json({ success: false, message: 'Séparation des fonctions: vous ne pouvez pas soumettre votre propre rapprochement', code: 'DUAL_CONTROL_VIOLATION' });
      return;
    }

    const updated = await prisma.rapprochement.update({
      where: { id: rapprochement_id },
      data: { statut: 'SOUMIS', soumis_par: req.user!.userId, updated_by: req.user!.userId },
    });

    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

// ── GET /api/reconciliation/list ─────────────────────────────
// Liste des rapprochements du tenant avec inclusions
router.get('/list', async (req: AuthRequest, res: Response): Promise<void> => {
  const { limit = '50', offset = '0', statut } = req.query;
  try {
    const rapprochements = await prisma.rapprochement.findMany({
      where: {
        entreprise: { tenant_id: req.user!.tenantId },
        ...(statut ? { statut: statut as any } : {}),
      },
      include: {
        entreprise: { select: { id: true, nom: true, code: true } },
        compte_bancaire: { include: { banque: { select: { id: true, nom: true } } } },
        justificatifs: { select: { id: true, nom_fichier: true, url_fichier: true, type_fichier: true } },
      },
      orderBy: [{ periode_annee: 'desc' }, { periode_mois: 'desc' }],
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });
    const total = await prisma.rapprochement.count({
      where: { entreprise: { tenant_id: req.user!.tenantId } },
    });
    res.json({ success: true, data: rapprochements, meta: { total } });
  } catch (err) {
    console.error('[RECONCILIATION/LIST]', err);
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

export default router;

