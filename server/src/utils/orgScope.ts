import prisma from '../config/db';
import type { JwtPayload } from '../middleware/auth';

// Seul SUPER_ADMIN voit l'intégralité du tenant sans restriction. ADMIN_TENANT
// est un rôle (droits d'administration : gestion des utilisateurs, de la
// hiérarchie, etc.) distinct de son rattachement organisationnel : un
// ADMIN_TENANT rattaché à une entreprise/succursale/sous-succursale ne gère
// et ne voit que le périmètre correspondant, comme n'importe quel utilisateur.
const UNRESTRICTED_ROLES = ['SUPER_ADMIN'];

export interface OrgScope {
  unrestricted: boolean;
  // Toujours résolus dès qu'un rattachement existe, quel que soit son niveau
  // (utile pour renseigner entreprise_id/succursale_id à la création de
  // ressources). Le filtrage de visibilité privilégie le niveau le plus
  // profond renseigné : sousSuccursaleId > succursaleId > entrepriseId.
  entrepriseId: number | null;
  succursaleId: number | null;
  sousSuccursaleId: number | null;
}

interface Attachment {
  entrepriseId?: number | null;
  succursaleId?: number | null;
  sousSuccursaleId?: number | null;
  directionId?: number | null;
  serviceId?: number | null;
}

// Résout entreprise_id/succursale_id/sous_succursale_id effectifs à partir
// d'un rattachement brut (un seul niveau renseigné) — remonte direction/service
// jusqu'à leur succursale parente (les banques/comptes/écritures ne sont
// scopés qu'aux niveaux entreprise/succursale/sous-succursale).
async function resolveAttachmentScope(a: Attachment): Promise<{ entrepriseId: number | null; succursaleId: number | null; sousSuccursaleId: number | null }> {
  if (a.sousSuccursaleId) {
    const ss = await prisma.sousSuccursale.findUnique({
      where: { id: a.sousSuccursaleId },
      select: { succursale_id: true, succursale: { select: { entreprise_id: true } } },
    });
    return { entrepriseId: ss?.succursale.entreprise_id ?? null, succursaleId: ss?.succursale_id ?? null, sousSuccursaleId: a.sousSuccursaleId };
  }
  if (a.succursaleId) {
    const s = await prisma.succursale.findUnique({ where: { id: a.succursaleId }, select: { entreprise_id: true } });
    return { entrepriseId: s?.entreprise_id ?? null, succursaleId: a.succursaleId, sousSuccursaleId: null };
  }
  if (a.directionId) {
    const d = await prisma.direction.findUnique({
      where: { id: a.directionId },
      select: { succursale_id: true, succursale: { select: { entreprise_id: true } } },
    });
    return { entrepriseId: d?.succursale.entreprise_id ?? null, succursaleId: d?.succursale_id ?? null, sousSuccursaleId: null };
  }
  if (a.serviceId) {
    const svc = await prisma.service.findUnique({
      where: { id: a.serviceId },
      select: { direction: { select: { succursale_id: true, succursale: { select: { entreprise_id: true } } } } },
    });
    return {
      entrepriseId: svc?.direction.succursale.entreprise_id ?? null,
      succursaleId: svc?.direction.succursale_id ?? null,
      sousSuccursaleId: null,
    };
  }
  if (a.entrepriseId) {
    return { entrepriseId: a.entrepriseId, succursaleId: null, sousSuccursaleId: null };
  }
  return { entrepriseId: null, succursaleId: null, sousSuccursaleId: null };
}

// Résout le périmètre effectif d'un utilisateur connecté à partir des claims
// de son JWT.
export async function resolveOrgScope(user: JwtPayload): Promise<OrgScope> {
  if (UNRESTRICTED_ROLES.includes(user.role)) {
    return { unrestricted: true, entrepriseId: null, succursaleId: null, sousSuccursaleId: null };
  }
  const resolved = await resolveAttachmentScope(user);
  if (!resolved.entrepriseId && !resolved.succursaleId && !resolved.sousSuccursaleId) {
    // Aucun rattachement défini (ex. compte legacy) : pas de restriction supplémentaire.
    return { unrestricted: true, entrepriseId: null, succursaleId: null, sousSuccursaleId: null };
  }
  return { unrestricted: false, ...resolved };
}

// Résout le périmètre d'un rattachement brut (utilisé pour vérifier qu'un
// admin scopé n'affecte pas un utilisateur en dehors de son propre périmètre).
export async function resolveTargetScope(target: Attachment): Promise<{ entrepriseId: number | null; succursaleId: number | null; sousSuccursaleId: number | null }> {
  return resolveAttachmentScope(target);
}

// Un périmètre `scope` englobe-t-il le rattachement `target` ? true si scope
// est non restreint, ou si target tombe dans la branche la plus profonde de scope.
export function scopeContains(scope: OrgScope, target: { entrepriseId: number | null; succursaleId: number | null; sousSuccursaleId: number | null }): boolean {
  if (scope.unrestricted) return true;
  if (scope.sousSuccursaleId) return target.sousSuccursaleId === scope.sousSuccursaleId;
  if (scope.succursaleId) return target.succursaleId === scope.succursaleId;
  if (scope.entrepriseId) return target.entrepriseId === scope.entrepriseId;
  return true;
}

// Clause `where` à fusionner (spread) pour une ressource portant elle-même
// `entreprise_id`/`succursale_id`/`sous_succursale_id` (CompteBancaire, EcritureComptable).
export function orgScopeWhere(scope: OrgScope): Record<string, unknown> {
  if (scope.unrestricted) return {};
  if (scope.sousSuccursaleId) return { sous_succursale_id: scope.sousSuccursaleId };
  if (scope.succursaleId) return { succursale_id: scope.succursaleId };
  if (scope.entrepriseId) return { entreprise_id: scope.entrepriseId };
  return {};
}

// Variante pour Banque : entreprise_id/succursale_id/sous_succursale_id y sont
// optionnels, une banque non rattachée (legacy, partagée au niveau du tenant)
// reste visible par tout le monde en plus de celles qui correspondent au périmètre.
export function banqueScopeWhere(scope: OrgScope): Record<string, unknown> {
  if (scope.unrestricted) return {};
  return { OR: [orgScopeWhere(scope), { entreprise_id: null, succursale_id: null, sous_succursale_id: null }] };
}

// Clause `where` pour lister les Utilisateur du périmètre — contrairement à
// Banque/CompteBancaire/EcritureComptable, un utilisateur cible peut être
// rattaché à n'importe lequel des 5 niveaux, il faut donc traverser toutes les
// chaînes possibles jusqu'à la profondeur du périmètre de l'acteur.
export function userScopeWhere(scope: OrgScope): Record<string, unknown> {
  if (scope.unrestricted) return {};
  if (scope.sousSuccursaleId) {
    return { sous_succursale_id: scope.sousSuccursaleId };
  }
  if (scope.succursaleId) {
    return {
      OR: [
        { succursale_id: scope.succursaleId },
        { sous_succursale: { succursale_id: scope.succursaleId } },
        { direction: { succursale_id: scope.succursaleId } },
        { service: { direction: { succursale_id: scope.succursaleId } } },
      ],
    };
  }
  if (scope.entrepriseId) {
    return {
      OR: [
        { entreprise_id: scope.entrepriseId },
        { succursale: { entreprise_id: scope.entrepriseId } },
        { sous_succursale: { succursale: { entreprise_id: scope.entrepriseId } } },
        { direction: { succursale: { entreprise_id: scope.entrepriseId } } },
        { service: { direction: { succursale: { entreprise_id: scope.entrepriseId } } } },
      ],
    };
  }
  return {};
}
