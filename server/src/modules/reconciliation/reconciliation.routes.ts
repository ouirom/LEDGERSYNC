import { Router, Response } from 'express';
import { z } from 'zod';
import type { Rapprochement, StatutRapprochement, Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { createAuditEntry } from '../../middleware/auditLogger';
import { getIO } from '../../sockets/socketServer';
import { errorMessage } from '../../utils/errors';
import { resolveOrgScope, orgScopeWhere } from '../../utils/orgScope';

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
    const scope = await resolveOrgScope(req.user!);
    const compteAutorise = await prisma.compteBancaire.findFirst({
      where: { id: compteId, entreprise: { tenant_id: req.user!.tenantId }, ...orgScopeWhere(scope) },
    });
    if (!compteAutorise) { res.status(404).json({ success: false, message: 'Compte bancaire non trouvé ou hors de votre périmètre' }); return; }

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
          compte_bancaire: { entreprise: { tenant_id: req.user!.tenantId } },
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
      // Filtré par tenant + compte bancaire pour empêcher tout lettrage croisé entre tenants/comptes
      const ecritures = await tx.ecritureComptable.findMany({
        where: {
          id: { in: ecriture_ids },
          lettree: false,
          etat: { not: 'ANNULE' },
          compte_bancaire_id,
          entreprise: { id: entreprise_id, tenant_id: req.user!.tenantId },
        },
      });

      const releves = await tx.releveBancaireLigne.findMany({
        where: {
          id: { in: releve_ids },
          lettree: false,
          etat: { not: 'ANNULE' },
          compte_bancaire_id,
          compte_bancaire: { entreprise: { tenant_id: req.user!.tenantId } },
        },
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
  } catch (err) {
    res.status(422).json({ success: false, message: errorMessage(err, 'Erreur lors du lettrage') });
  }
});

// ── POST /api/reconciliation/ecart ──────────────────────────
// Apurement automatique d'un micro-écart (arrondi de change) sous le seuil de
// tolérance paramétrable : crée une écriture d'imputation vers le compte dédié
// de la catégorie choisie, puis lettre l'ensemble (transaction ACID).
router.post('/ecart', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = ecartSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const { ecriture_ids, releve_ids, entreprise_id, compte_bancaire_id, periode_mois, periode_annee, montant_ecart, imputation_categorie_id, motif } = parsed.data;

  const seuil = parseFloat(process.env.MICRO_ECART_SEUIL || '0.05');
  if (Math.abs(montant_ecart) > seuil) {
    res.status(422).json({ success: false, message: `Écart (${montant_ecart}) supérieur au seuil de tolérance (${seuil}). L'apurement automatique est réservé aux micro-écarts.`, code: 'ECART_OUT_OF_TOLERANCE' });
    return;
  }
  if (Math.abs(montant_ecart) < 0.0001) {
    res.status(400).json({ success: false, message: 'Aucun écart à apurer' }); return;
  }

  // Vérifier verrouillage de période
  const periode = await prisma.periodeComptable.findUnique({
    where: { entreprise_id_mois_annee: { entreprise_id, mois: periode_mois, annee: periode_annee } },
  });
  if (periode && (periode.statut === 'VERROUILLE' || periode.statut === 'CLOS')) {
    res.status(423).json({ success: false, message: `Période ${periode_mois}/${periode_annee} verrouillée`, code: 'PERIOD_LOCKED' });
    return;
  }

  const categorie = await prisma.imputationCategorie.findFirst({
    where: { id: imputation_categorie_id, tenant_id: req.user!.tenantId, etat: { not: 'ARCHIVE' } },
  });
  if (!categorie) { res.status(404).json({ success: false, message: 'Catégorie d\'imputation non trouvée' }); return; }

  const lettrageRef = `APU-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const ecritures = await tx.ecritureComptable.findMany({
        where: { id: { in: ecriture_ids }, lettree: false, etat: { not: 'ANNULE' }, compte_bancaire_id, entreprise: { id: entreprise_id, tenant_id: req.user!.tenantId } },
      });
      const releves = await tx.releveBancaireLigne.findMany({
        where: { id: { in: releve_ids }, lettree: false, etat: { not: 'ANNULE' }, compte_bancaire_id, compte_bancaire: { entreprise: { tenant_id: req.user!.tenantId } } },
      });
      if (ecritures.length !== ecriture_ids.length || releves.length !== releve_ids.length) {
        throw new Error('Certaines écritures ou lignes de relevé sont déjà lettrées ou introuvables');
      }

      // Écriture d'imputation de l'écart vers le compte dédié de la catégorie
      const imputation = await tx.ecritureComptable.create({
        data: {
          entreprise_id, compte_bancaire_id,
          reference: `APU-${categorie.code}-${Date.now()}`,
          libelle: `Apurement micro-écart — ${categorie.libelle}${categorie.compte_imputation ? ` (${categorie.compte_imputation})` : ''}`,
          montant: Math.abs(montant_ecart),
          type: categorie.type,
          date_ecriture: new Date(),
          piece_ref: categorie.code,
          periode_mois, periode_annee,
          lettree: true, lettrage_ref: lettrageRef,
          etat: 'VALIDE',
          created_by: req.user!.userId, updated_by: req.user!.userId,
        },
      });

      await tx.ecritureComptable.updateMany({
        where: { id: { in: ecriture_ids } },
        data: { lettree: true, lettrage_ref: lettrageRef, updated_by: req.user!.userId },
      });
      await tx.releveBancaireLigne.updateMany({
        where: { id: { in: releve_ids } },
        data: { lettree: true, lettrage_ref: lettrageRef, updated_by: req.user!.userId },
      });

      return { lettrageRef, imputationId: imputation.id, ecrituresLettrees: ecritures.length, relevesLettres: releves.length };
    });

    await createAuditEntry({
      tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'APUREMENT_ECART', action: 'CREATE',
      apres: { ...result, montant_ecart, categorie: categorie.libelle }, motif, ipAddress: req.ip,
    });

    const io = getIO();
    io.to(`tenant-${req.user!.tenantId}`).emit('lettrage:created', { lettrageRef: result.lettrageRef, compteId: compte_bancaire_id, periode: { mois: periode_mois, annee: periode_annee } });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(422).json({ success: false, message: errorMessage(err, 'Erreur lors de l\'apurement de l\'écart') });
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
    // Vérifier que le lettrage appartient bien au tenant, et récupérer sa période
    const ecritureRef = await prisma.ecritureComptable.findFirst({
      where: { lettrage_ref: ref, entreprise: { tenant_id: req.user!.tenantId } },
    });
    if (!ecritureRef) { res.status(404).json({ success: false, message: 'Lettrage non trouvé' }); return; }

    // Interdiction de dé-lettrer sur une période verrouillée/close
    const periode = await prisma.periodeComptable.findUnique({
      where: { entreprise_id_mois_annee: { entreprise_id: ecritureRef.entreprise_id, mois: ecritureRef.periode_mois, annee: ecritureRef.periode_annee } },
    });
    if (periode && (periode.statut === 'VERROUILLE' || periode.statut === 'CLOS')) {
      res.status(423).json({ success: false, message: `Période ${ecritureRef.periode_mois}/${ecritureRef.periode_annee} verrouillée`, code: 'PERIOD_LOCKED' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.ecritureComptable.updateMany({
        where: { lettrage_ref: ref, entreprise: { tenant_id: req.user!.tenantId } },
        data: { lettree: false, lettrage_ref: null, motif_annulation: motif, updated_by: req.user!.userId },
      });
      await tx.releveBancaireLigne.updateMany({
        where: { lettrage_ref: ref, compte_bancaire: { entreprise: { tenant_id: req.user!.tenantId } } },
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
        compte_bancaire: { entreprise: { tenant_id: req.user!.tenantId } },
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

// ── POST /api/reconciliation/rapprochement ─────────────────
// Créer (ou mettre à jour l'écart d'un) rapprochement BROUILLON pour une période/compte donnés
router.post('/rapprochement', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    entreprise_id: z.number().int().positive(),
    compte_bancaire_id: z.number().int().positive(),
    periode_mois: z.number().int().min(1).max(12),
    periode_annee: z.number().int().min(2000),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const { entreprise_id, compte_bancaire_id, periode_mois, periode_annee } = parsed.data;

  const compte = await prisma.compteBancaire.findFirst({
    where: { id: compte_bancaire_id, entreprise_id, entreprise: { tenant_id: req.user!.tenantId } },
  });
  if (!compte) { res.status(404).json({ success: false, message: 'Compte bancaire non trouvé' }); return; }

  try {
    // Écart résiduel = somme des écritures non lettrées - somme des lignes de relevé non lettrées (signées)
    const [ecrituresNonLettrees, relevesNonLettres] = await Promise.all([
      prisma.ecritureComptable.findMany({
        where: { compte_bancaire_id, periode_mois, periode_annee, lettree: false, etat: { not: 'ANNULE' } },
      }),
      prisma.releveBancaireLigne.findMany({
        where: {
          compte_bancaire_id, lettree: false, etat: { not: 'ANNULE' },
          date_operation: { gte: new Date(periode_annee, periode_mois - 1, 1), lt: new Date(periode_annee, periode_mois, 1) },
        },
      }),
    ]);
    const signe = (t: string, m: number) => (t === 'CREDIT' ? m : -m);
    const totalEcritures = ecrituresNonLettrees.reduce((s, e) => s + signe(e.type, Number(e.montant)), 0);
    const totalReleves = relevesNonLettres.reduce((s, r) => s + signe(r.type, Number(r.montant)), 0);
    const montant_ecart = Math.round((totalEcritures - totalReleves) * 100) / 100;

    const rapprochement = await prisma.rapprochement.upsert({
      where: { entreprise_id_compte_bancaire_id_periode_mois_periode_annee: { entreprise_id, compte_bancaire_id, periode_mois, periode_annee } },
      update: { montant_ecart, updated_by: req.user!.userId },
      create: {
        entreprise_id, compte_bancaire_id, periode_mois, periode_annee,
        montant_ecart, statut: 'BROUILLON', etat: 'BROUILLON',
        created_by: req.user!.userId, updated_by: req.user!.userId,
      },
    });

    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'RAPPROCHEMENT', entiteId: rapprochement.id, action: 'CREATE', apres: rapprochement, ipAddress: req.ip });
    res.status(201).json({ success: true, data: rapprochement });
  } catch (err) {
    console.error('[RECONCILIATION/RAPPROCHEMENT]', err);
    res.status(500).json({ success: false, message: 'Erreur lors de la création du rapprochement' });
  }
});

// ── POST /api/reconciliation/submit ────────────────────────
// Soumettre le rapprochement pour validation dual-control
router.post('/submit', async (req: AuthRequest, res: Response): Promise<void> => {
  const { rapprochement_id } = req.body as { rapprochement_id: number };

  try {
    const rapprochement = await prisma.rapprochement.findFirst({ where: { id: rapprochement_id, entreprise: { tenant_id: req.user!.tenantId } } });
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

// ── Workflow de validation à double niveau (Superviseur -> Manager -> DAF) ──
// À chaque étape, la personne qui valide ne peut pas être celle qui a créé,
// soumis ou validé le niveau précédent (séparation des fonctions).
const VALIDATION_STEPS: Array<{
  path: string; fromStatut: StatutRapprochement; toStatut: StatutRapprochement; roles: string[];
  priorActors: (r: Rapprochement) => (number | null | undefined)[];
  setField: 'valide_n1_par' | 'valide_n2_par' | 'valide_final_par';
}> = [
  { path: 'validate-n1', fromStatut: 'SOUMIS', toStatut: 'VALIDE_N1', roles: ['SUPERVISEUR', 'MANAGER', 'DAF', 'ADMIN_TENANT', 'SUPER_ADMIN'], priorActors: r => [r.created_by, r.soumis_par], setField: 'valide_n1_par' },
  { path: 'validate-n2', fromStatut: 'VALIDE_N1', toStatut: 'VALIDE_N2', roles: ['MANAGER', 'DAF', 'ADMIN_TENANT', 'SUPER_ADMIN'], priorActors: r => [r.created_by, r.soumis_par, r.valide_n1_par], setField: 'valide_n2_par' },
  { path: 'validate-final', fromStatut: 'VALIDE_N2', toStatut: 'VALIDE_FINAL', roles: ['DAF', 'ADMIN_TENANT', 'SUPER_ADMIN'], priorActors: r => [r.created_by, r.soumis_par, r.valide_n1_par, r.valide_n2_par], setField: 'valide_final_par' },
];

for (const step of VALIDATION_STEPS) {
  router.post(`/:id/${step.path}`, async (req: AuthRequest, res: Response): Promise<void> => {
    const id = parseInt(req.params['id'] as string);
    if (!step.roles.includes(req.user!.role)) {
      res.status(403).json({ success: false, message: 'Rôle insuffisant pour cette validation' }); return;
    }

    try {
      const rapprochement = await prisma.rapprochement.findFirst({ where: { id, entreprise: { tenant_id: req.user!.tenantId } } });
      if (!rapprochement) { res.status(404).json({ success: false, message: 'Rapprochement non trouvé' }); return; }
      if (rapprochement.statut !== step.fromStatut) {
        res.status(409).json({ success: false, message: `Statut actuel (${rapprochement.statut}) incompatible avec cette étape` }); return;
      }
      if (step.priorActors(rapprochement).includes(req.user!.userId)) {
        res.status(403).json({ success: false, message: 'Séparation des fonctions: vous ne pouvez pas valider une étape que vous avez déjà traitée', code: 'DUAL_CONTROL_VIOLATION' });
        return;
      }

      const data: Prisma.RapprochementUpdateInput = {
        statut: step.toStatut,
        updated_by: req.user!.userId,
        ...(step.toStatut === 'VALIDE_FINAL' ? { date_validation_final: new Date() } : {}),
      };
      (data as Record<string, unknown>)[step.setField] = req.user!.userId;

      const updated = await prisma.rapprochement.update({ where: { id }, data });

      await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'RAPPROCHEMENT', entiteId: id, action: step.toStatut, avant: { statut: rapprochement.statut }, apres: { statut: step.toStatut }, ipAddress: req.ip });

      const io = getIO();
      io.to(`tenant-${req.user!.tenantId}`).emit('rapprochement:updated', { id, statut: step.toStatut });

      res.json({ success: true, data: updated });
    } catch {
      res.status(500).json({ success: false, message: 'Erreur interne' });
    }
  });
}

// ── POST /api/reconciliation/:id/reject ─────────────────────
// Rejet à n'importe quelle étape de validation (motif obligatoire)
router.post('/:id/reject', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'] as string);
  const { motif } = req.body as { motif: string };
  if (!motif || motif.trim().length < 5) {
    res.status(400).json({ success: false, message: 'Motif de rejet obligatoire (min. 5 caractères)' }); return;
  }
  if (!['SUPERVISEUR', 'MANAGER', 'DAF', 'ADMIN_TENANT', 'SUPER_ADMIN'].includes(req.user!.role)) {
    res.status(403).json({ success: false, message: 'Rôle insuffisant' }); return;
  }

  try {
    const rapprochement = await prisma.rapprochement.findFirst({ where: { id, entreprise: { tenant_id: req.user!.tenantId } } });
    if (!rapprochement) { res.status(404).json({ success: false, message: 'Rapprochement non trouvé' }); return; }
    if (!['SOUMIS', 'VALIDE_N1', 'VALIDE_N2'].includes(rapprochement.statut)) {
      res.status(409).json({ success: false, message: `Statut actuel (${rapprochement.statut}) ne peut pas être rejeté` }); return;
    }

    const updated = await prisma.rapprochement.update({
      where: { id },
      data: { statut: 'REJETE', motif_rejet: motif, updated_by: req.user!.userId },
    });

    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'RAPPROCHEMENT', entiteId: id, action: 'REJETE', avant: { statut: rapprochement.statut }, apres: { statut: 'REJETE' }, motif, ipAddress: req.ip });
    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

// ── POST /api/reconciliation/:id/reopen ─────────────────────
// Remettre un rapprochement rejeté en brouillon pour correction
router.post('/:id/reopen', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'] as string);
  try {
    const rapprochement = await prisma.rapprochement.findFirst({ where: { id, entreprise: { tenant_id: req.user!.tenantId } } });
    if (!rapprochement) { res.status(404).json({ success: false, message: 'Rapprochement non trouvé' }); return; }
    if (rapprochement.statut !== 'REJETE') {
      res.status(409).json({ success: false, message: 'Seul un rapprochement rejeté peut être réouvert' }); return;
    }

    const updated = await prisma.rapprochement.update({
      where: { id },
      data: { statut: 'BROUILLON', soumis_par: null, valide_n1_par: null, valide_n2_par: null, updated_by: req.user!.userId },
    });

    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'RAPPROCHEMENT', entiteId: id, action: 'REOPEN', avant: { statut: 'REJETE' }, apres: { statut: 'BROUILLON' }, ipAddress: req.ip });
    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

// ── POST /api/reconciliation/:id/reopen-finalized ────────────
// Réouverture exceptionnelle d'un rapprochement déjà VALIDE_FINAL (ou CLOS) :
// jusqu'ici aucune erreur découverte après la signature finale du DAF ne
// pouvait être corrigée (reject/reopen ne s'appliquent qu'à SOUMIS/N1/N2/
// REJETE). Réservée aux rôles de plus haut niveau, motif obligatoire, et la
// chaîne de validation est intégralement remise à zéro : la correction devra
// repasser par tout le circuit dual-control plutôt que d'être resignée
// silencieusement par une seule personne.
router.post('/:id/reopen-finalized', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'] as string);
  const { motif } = req.body as { motif: string };
  if (!motif || motif.trim().length < 5) {
    res.status(400).json({ success: false, message: 'Motif de réouverture obligatoire (min. 5 caractères)' }); return;
  }
  if (!['DAF', 'ADMIN_TENANT', 'SUPER_ADMIN'].includes(req.user!.role)) {
    res.status(403).json({ success: false, message: 'Rôle insuffisant pour rouvrir un rapprochement validé' }); return;
  }

  try {
    const rapprochement = await prisma.rapprochement.findFirst({ where: { id, entreprise: { tenant_id: req.user!.tenantId } } });
    if (!rapprochement) { res.status(404).json({ success: false, message: 'Rapprochement non trouvé' }); return; }
    if (!['VALIDE_FINAL', 'CLOS'].includes(rapprochement.statut)) {
      res.status(409).json({ success: false, message: 'Seul un rapprochement validé (final) ou clos peut être réouvert de cette façon' }); return;
    }
    if (rapprochement.valide_final_par === req.user!.userId) {
      res.status(403).json({ success: false, message: 'Séparation des fonctions : vous ne pouvez pas rouvrir un rapprochement que vous avez vous-même validé en dernier lieu', code: 'DUAL_CONTROL_VIOLATION' });
      return;
    }

    const updated = await prisma.rapprochement.update({
      where: { id },
      data: {
        statut: 'BROUILLON',
        soumis_par: null, valide_n1_par: null, valide_n2_par: null, valide_final_par: null, date_validation_final: null,
        reouvert_par: req.user!.userId, date_reouverture: new Date(), motif_reouverture: motif,
        updated_by: req.user!.userId,
      },
    });

    await createAuditEntry({
      tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'RAPPROCHEMENT', entiteId: id, action: 'REOPEN_FINALIZED',
      avant: { statut: rapprochement.statut }, apres: { statut: 'BROUILLON' }, motif, ipAddress: req.ip,
    });

    const io = getIO();
    io.to(`tenant-${req.user!.tenantId}`).emit('rapprochement:updated', { id, statut: 'BROUILLON' });

    res.json({ success: true, data: updated, message: 'Rapprochement réouvert — la correction devra être resoumise pour validation complète.' });
  } catch {
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

// ── GET /api/reconciliation/list ─────────────────────────────
// Liste des rapprochements du tenant avec inclusions, filtrable et scopée
// au périmètre organisationnel de l'utilisateur (via son compte bancaire —
// Rapprochement ne porte pas lui-même de succursale_id/sous_succursale_id).
router.get('/list', async (req: AuthRequest, res: Response): Promise<void> => {
  const { limit = '50', offset = '0', statut, entreprise_id, compte_bancaire_id, mois, annee } = req.query;
  try {
    const scope = await resolveOrgScope(req.user!);
    const where: Prisma.RapprochementWhereInput = {
      entreprise: { tenant_id: req.user!.tenantId },
      compte_bancaire: { ...orgScopeWhere(scope) },
      ...(statut ? { statut: statut as StatutRapprochement } : {}),
      ...(entreprise_id ? { entreprise_id: parseInt(entreprise_id as string) } : {}),
      ...(compte_bancaire_id ? { compte_bancaire_id: parseInt(compte_bancaire_id as string) } : {}),
      ...(mois ? { periode_mois: parseInt(mois as string) } : {}),
      ...(annee ? { periode_annee: parseInt(annee as string) } : {}),
    };

    const [rapprochements, total] = await Promise.all([
      prisma.rapprochement.findMany({
        where,
        include: {
          entreprise: { select: { id: true, nom: true, code: true } },
          compte_bancaire: { include: { banque: { select: { id: true, nom: true } } } },
          justificatifs: { select: { id: true, nom_fichier: true, url_fichier: true, type_fichier: true } },
        },
        orderBy: [{ periode_annee: 'desc' }, { periode_mois: 'desc' }],
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.rapprochement.count({ where }),
    ]);
    res.json({ success: true, data: rapprochements, meta: { total } });
  } catch (err) {
    console.error('[RECONCILIATION/LIST]', err);
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

export default router;

