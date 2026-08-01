import { Router, Response } from 'express';
import type { Rapprochement } from '@prisma/client';
import prisma from '../../config/db';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { resolveOrgScope, orgScopeWhere } from '../../utils/orgScope';

const router = Router();
router.use(authenticate);

const MAX_ITEMS = 8;

// Mêmes règles que VALIDATION_STEPS dans reconciliation.routes.ts : à chaque
// statut correspond le(s) rôle(s) habilité(s) à faire avancer le rapprochement,
// et la liste des acteurs déjà intervenus (exclus par séparation des fonctions).
const PENDING_VALIDATION_RULES: Record<string, { roles: string[]; priorActors: (r: Rapprochement) => (number | null | undefined)[] }> = {
  SOUMIS: { roles: ['SUPERVISEUR', 'MANAGER', 'DAF', 'ADMIN_TENANT', 'SUPER_ADMIN'], priorActors: r => [r.created_by, r.soumis_par] },
  VALIDE_N1: { roles: ['MANAGER', 'DAF', 'ADMIN_TENANT', 'SUPER_ADMIN'], priorActors: r => [r.created_by, r.soumis_par, r.valide_n1_par] },
  VALIDE_N2: { roles: ['DAF', 'ADMIN_TENANT', 'SUPER_ADMIN'], priorActors: r => [r.created_by, r.soumis_par, r.valide_n1_par, r.valide_n2_par] },
};

const summarize = (r: Rapprochement & { entreprise: { nom: string }; compte_bancaire: { numero_compte: string; banque: { nom: string } } }) => ({
  id: r.id,
  entreprise: r.entreprise.nom,
  compte: `${r.compte_bancaire.banque.nom} · ${r.compte_bancaire.numero_compte}`,
  compte_bancaire_id: r.compte_bancaire_id,
  periode_mois: r.periode_mois,
  periode_annee: r.periode_annee,
  statut: r.statut,
  montant_ecart: r.montant_ecart,
});

// ── GET /api/notifications/summary ─────────────────────────
// Alertes dérivées à la volée depuis les rapprochements existants (aucune
// table dédiée) : validations en attente de l'action du rôle courant, et
// écarts non résolus sur des rapprochements pas encore soumis (BROUILLON/EN_COURS).
router.get('/summary', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const scope = await resolveOrgScope(req.user!);
    const baseWhere = {
      entreprise: { tenant_id: req.user!.tenantId },
      compte_bancaire: { ...orgScopeWhere(scope) },
    };

    const [candidatsValidation, ecartsBruts] = await Promise.all([
      prisma.rapprochement.findMany({
        where: { ...baseWhere, statut: { in: ['SOUMIS', 'VALIDE_N1', 'VALIDE_N2'] } },
        include: { entreprise: { select: { nom: true } }, compte_bancaire: { select: { numero_compte: true, banque: { select: { nom: true } } } } },
        orderBy: { updated_at: 'desc' },
      }),
      prisma.rapprochement.findMany({
        where: { ...baseWhere, statut: { in: ['BROUILLON', 'EN_COURS'] } },
        include: { entreprise: { select: { nom: true } }, compte_bancaire: { select: { numero_compte: true, banque: { select: { nom: true } } } } },
        orderBy: { updated_at: 'desc' },
      }),
    ]);

    const validationsEnAttente = candidatsValidation.filter(r => {
      const rule = PENDING_VALIDATION_RULES[r.statut];
      if (!rule) return false;
      if (!rule.roles.includes(req.user!.role)) return false;
      return !rule.priorActors(r).includes(req.user!.userId);
    });

    const ecartsNonResolus = ecartsBruts.filter(r => Math.abs(Number(r.montant_ecart)) > 0.01);

    res.json({
      success: true,
      data: {
        validationsEnAttente: { total: validationsEnAttente.length, items: validationsEnAttente.slice(0, MAX_ITEMS).map(summarize) },
        ecartsNonResolus: { total: ecartsNonResolus.length, items: ecartsNonResolus.slice(0, MAX_ITEMS).map(summarize) },
      },
    });
  } catch (err) {
    console.error('[NOTIFICATIONS/SUMMARY]', err);
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

export default router;
