import { Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AuthRequest } from './auth';

/**
 * Guard: Vérifie qu'une période comptable est OUVERTE avant toute modification.
 * Utilisé sur les routes d'import, de lettrage et d'annulation.
 */
export const periodLockGuard = (getPeriodInfo: (req: AuthRequest) => { mois: number; annee: number; entrepriseId: number } | null) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const info = getPeriodInfo(req);
    if (!info) {
      next();
      return;
    }

    const { mois, annee, entrepriseId } = info;

    try {
      const periode = await prisma.periodeComptable.findUnique({
        where: {
          entreprise_id_mois_annee: {
            entreprise_id: entrepriseId,
            mois,
            annee,
          },
        },
      });

      if (periode && (periode.statut === 'VERROUILLE' || periode.statut === 'CLOS')) {
        res.status(423).json({
          success: false,
          message: `La période ${mois}/${annee} est ${periode.statut}. Aucune modification autorisée.`,
          code: 'PERIOD_LOCKED',
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};
