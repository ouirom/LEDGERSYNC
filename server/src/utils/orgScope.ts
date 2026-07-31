import prisma from '../config/db';
import type { JwtPayload } from '../middleware/auth';

// Rôles dont le périmètre d'accès n'est pas restreint à un rattachement
// organisationnel : ils voient toutes les données du tenant, comme avant
// l'introduction du rattachement multi-niveau.
const UNRESTRICTED_ROLES = ['SUPER_ADMIN', 'ADMIN_TENANT'];

export interface OrgScope {
  unrestricted: boolean;
  // Toujours résolu dès qu'un rattachement existe (y compris pour un niveau
  // succursale/direction/service) — utile pour renseigner entreprise_id à la
  // création de ressources. Le filtrage de visibilité, lui, se base en priorité
  // sur succursaleId quand il est renseigné (voir orgScopeWhere).
  entrepriseId: number | null;
  succursaleId: number | null;
}

// Résout le périmètre effectif d'un utilisateur à partir de son rattachement
// (entreprise, succursale, direction ou service — un seul est renseigné).
// Les banques/comptes/écritures ne sont scopés qu'au niveau entreprise ou
// succursale ; un rattachement direction/service est donc remonté jusqu'à sa
// succursale parente.
export async function resolveOrgScope(user: JwtPayload): Promise<OrgScope> {
  if (UNRESTRICTED_ROLES.includes(user.role)) {
    return { unrestricted: true, entrepriseId: null, succursaleId: null };
  }
  if (user.succursaleId) {
    const succursale = await prisma.succursale.findUnique({ where: { id: user.succursaleId }, select: { entreprise_id: true } });
    return { unrestricted: false, entrepriseId: succursale?.entreprise_id ?? null, succursaleId: user.succursaleId };
  }
  if (user.directionId) {
    const direction = await prisma.direction.findUnique({
      where: { id: user.directionId },
      select: { succursale_id: true, succursale: { select: { entreprise_id: true } } },
    });
    return { unrestricted: false, entrepriseId: direction?.succursale.entreprise_id ?? null, succursaleId: direction?.succursale_id ?? null };
  }
  if (user.serviceId) {
    const service = await prisma.service.findUnique({
      where: { id: user.serviceId },
      select: { direction: { select: { succursale_id: true, succursale: { select: { entreprise_id: true } } } } },
    });
    return {
      unrestricted: false,
      entrepriseId: service?.direction.succursale.entreprise_id ?? null,
      succursaleId: service?.direction.succursale_id ?? null,
    };
  }
  if (user.entrepriseId) {
    return { unrestricted: false, entrepriseId: user.entrepriseId, succursaleId: null };
  }
  // Aucun rattachement défini (ex. compte legacy) : pas de restriction supplémentaire.
  return { unrestricted: true, entrepriseId: null, succursaleId: null };
}

// Clause `where` à fusionner (spread) pour une ressource portant elle-même
// `entreprise_id`/`succursale_id` (CompteBancaire, EcritureComptable).
export function orgScopeWhere(scope: OrgScope): Record<string, unknown> {
  if (scope.unrestricted) return {};
  if (scope.succursaleId) return { succursale_id: scope.succursaleId };
  if (scope.entrepriseId) return { entreprise_id: scope.entrepriseId };
  return {};
}

// Variante pour Banque : entreprise_id/succursale_id y sont optionnels, une
// banque non rattachée (legacy, partagée au niveau du tenant) reste visible
// par tout le monde en plus de celles qui correspondent au périmètre.
export function banqueScopeWhere(scope: OrgScope): Record<string, unknown> {
  if (scope.unrestricted) return {};
  return { OR: [orgScopeWhere(scope), { entreprise_id: null, succursale_id: null }] };
}
