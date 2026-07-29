import { Prisma } from '@prisma/client';

/** True if err is a Prisma known-request error with the given code (e.g. 'P2002' unique constraint). */
export function isPrismaError(err: unknown, code: string): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;
}

/** Extracts a human-readable message from an unknown catch value, with a fallback. */
export function errorMessage(err: unknown, fallback = 'Erreur interne'): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
