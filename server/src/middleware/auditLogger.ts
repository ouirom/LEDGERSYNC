import { Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../config/db';
import { AuthRequest } from './auth';

/**
 * Enregistre chaque action sensible dans la piste d'audit (logs_traitement).
 */
export const auditLog = (action: string, entite: string) => {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    // Post-action hook — appelé via wrapper dans les controllers
    (req as AuthRequest & { auditMeta: { action: string; entite: string } }).auditMeta = { action, entite };
    next();
  };
};

export const createAuditEntry = async (params: {
  tenantId: number;
  userId?: number;
  entite: string;
  entiteId?: number;
  action: string;
  // Snapshot libre de l'état avant/après (peut inclure des Decimal/Date issus de Prisma) —
  // sérialisé en JSON à l'écriture ; `unknown` plutôt que `any` pour forcer un cast explicite ci-dessous.
  avant?: unknown;
  apres?: unknown;
  motif?: string;
  ipAddress?: string;
}) => {
  try {
    await prisma.logTraitement.create({
      data: {
        tenant_id: params.tenantId,
        utilisateur_id: params.userId,
        entite: params.entite,
        entite_id: params.entiteId,
        action: params.action,
        avant: params.avant as Prisma.InputJsonValue | undefined,
        apres: params.apres as Prisma.InputJsonValue | undefined,
        motif: params.motif,
        ip_address: params.ipAddress,
        etat: 'ACTIF',
        created_by: params.userId,
        updated_by: params.userId,
      },
    });
  } catch (err) {
    console.error('[AUDIT] Failed to create audit log:', err);
  }
};
