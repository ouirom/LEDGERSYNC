import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import prisma from '../../config/db';
import { authenticate, AuthRequest, JwtPayload } from '../../middleware/auth';
import { sendPasswordResetEmail, sendPasswordChangedEmail } from '../../utils/mailer';

const router = Router();

const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_THRESHOLD = 5;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 heure

// ── Validation Schemas ──────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  tenant_code: z.string().optional(),
});

const forgotPasswordSchema = z.object({ email: z.string().email() });
const resetPasswordSchema = z.object({ token: z.string().min(1), password: z.string().min(6).max(100) });

const hashResetToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

// ── Helpers ─────────────────────────────────────────────────
const generateTokens = (payload: JwtPayload) => {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  } as jwt.SignOptions);

  const refreshToken = jwt.sign({ userId: payload.userId }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  } as jwt.SignOptions);

  return { accessToken, refreshToken };
};

// ── POST /api/auth/login ────────────────────────────────────
router.post('/login', async (req, res): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten() });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const user = await prisma.utilisateur.findFirst({
      where: { email, etat: 'ACTIF' },
      include: { tenant: true, entreprise: true },
    });

    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';

    if (!user) {
      // Ne pas logger avec utilisateur_id invalide — juste logger l'échec anonyme
      await prisma.logTraitement.create({
        data: {
          tenant_id: 0, // tenant inconnu lors d'un login raté par email inexistant
          utilisateur_id: undefined,
          entite: 'AUTH',
          action: 'LOGIN_FAIL',
          apres: { email, raison: 'Utilisateur non trouvé' },
          ip_address: ipAddress,
          etat: 'ACTIF',
          created_by: undefined,
          updated_by: undefined,
        },
      }).catch(() => {}); // Ne pas bloquer si le log échoue
      res.status(401).json({ success: false, message: 'Identifiants invalides' });
      return;
    }

    // Verrouillage temporaire après plusieurs échecs consécutifs (anti brute-force)
    const echecsRecents = await prisma.logConnexion.count({
      where: { utilisateur_id: user.id, succes: false, created_at: { gte: new Date(Date.now() - LOCKOUT_WINDOW_MS) } },
    });
    if (echecsRecents >= LOCKOUT_THRESHOLD) {
      res.status(423).json({ success: false, message: `Compte temporairement verrouillé après ${LOCKOUT_THRESHOLD} échecs. Réessayez dans quelques minutes.`, code: 'ACCOUNT_LOCKED' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      await prisma.logConnexion.create({
        data: {
          utilisateur_id: user.id,
          ip_address: ipAddress,
          user_agent: userAgent,
          succes: false,
          motif_echec: 'Mot de passe incorrect',
          created_by: user.id,
          updated_by: user.id,
        },
      });
      res.status(401).json({ success: false, message: 'Identifiants invalides' });
      return;
    }

    const payload: JwtPayload = {
      userId: user.id,
      tenantId: user.tenant_id,
      entrepriseId: user.entreprise_id ?? undefined,
      role: user.role,
      email: user.email,
    };

    const { accessToken, refreshToken } = generateTokens(payload);

    // Save refresh token (hashed — never store bearer tokens in plaintext) & update last login
    await prisma.utilisateur.update({
      where: { id: user.id },
      data: {
        refresh_token: await bcrypt.hash(refreshToken, 12),
        derniere_connexion: new Date(),
        updated_by: user.id,
      },
    });

    await prisma.logConnexion.create({
      data: {
        utilisateur_id: user.id,
        ip_address: ipAddress,
        user_agent: userAgent,
        succes: true,
        created_by: user.id,
        updated_by: user.id,
      },
    });

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        tenantId: user.tenant_id,
        tenantCode: user.tenant?.code,
        entrepriseId: user.entreprise_id,
        entrepriseNom: user.entreprise?.nom,
      },
    });
  } catch (err) {
    console.error('[AUTH/LOGIN]', err);
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

// ── POST /api/auth/refresh ──────────────────────────────────
router.post('/refresh', async (req, res): Promise<void> => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(401).json({ success: false, message: 'Refresh token requis' });
    return;
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: number };
    const user = await prisma.utilisateur.findFirst({
      where: { id: decoded.userId, etat: 'ACTIF' },
    });

    if (!user || !user.refresh_token || !(await bcrypt.compare(refreshToken, user.refresh_token))) {
      res.status(401).json({ success: false, message: 'Refresh token invalide' });
      return;
    }

    const payload: JwtPayload = {
      userId: user.id,
      tenantId: user.tenant_id,
      entrepriseId: user.entreprise_id ?? undefined,
      role: user.role,
      email: user.email,
    };

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(payload);

    await prisma.utilisateur.update({
      where: { id: user.id },
      data: { refresh_token: await bcrypt.hash(newRefreshToken, 12), updated_by: user.id },
    });

    res.json({ success: true, accessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ success: false, message: 'Refresh token invalide ou expiré' });
  }
});

// ── POST /api/auth/logout ───────────────────────────────────
router.post('/logout', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.utilisateur.update({
      where: { id: req.user!.userId },
      data: { refresh_token: null, updated_by: req.user!.userId },
    });
    res.json({ success: true, message: 'Déconnexion réussie' });
  } catch {
    res.status(500).json({ success: false, message: 'Erreur lors de la déconnexion' });
  }
});

// ── GET /api/auth/me ────────────────────────────────────────
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.utilisateur.findUnique({
      where: { id: req.user!.userId },
      include: { entreprise: { include: { theme: true } }, tenant: { include: { theme: true } } },
    });
    if (!user) { res.status(404).json({ success: false, message: 'Utilisateur non trouvé' }); return; }
    
    const { password_hash: _, refresh_token: __, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
  } catch {
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

// ── POST /api/auth/forgot-password ──────────────────────────
// Toujours répondre avec succès, que l'email existe ou non (pas d'énumération
// de comptes) : seul l'envoi effectif de l'email diffère selon le cas.
router.post('/forgot-password', async (req, res): Promise<void> => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const { email } = parsed.data;
  const genericResponse = { success: true, message: 'Si un compte existe avec cet email, un lien de réinitialisation vient de lui être envoyé.' };

  try {
    const user = await prisma.utilisateur.findFirst({ where: { email, etat: 'ACTIF' } });
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      await prisma.utilisateur.update({
        where: { id: user.id },
        data: { reset_token_hash: hashResetToken(rawToken), reset_token_expires: new Date(Date.now() + RESET_TOKEN_TTL_MS), updated_by: user.id },
      });
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      void sendPasswordResetEmail({ to: user.email, prenom: user.prenom, resetUrl: `${clientUrl}/reset-password?token=${rawToken}` });
    }
    res.json(genericResponse);
  } catch (err) {
    console.error('[AUTH/FORGOT-PASSWORD]', err);
    res.json(genericResponse); // ne jamais révéler d'erreur interne à ce stade non plus
  }
});

// ── POST /api/auth/reset-password ───────────────────────────
router.post('/reset-password', async (req, res): Promise<void> => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const { token, password } = parsed.data;

  try {
    const user = await prisma.utilisateur.findFirst({
      where: { reset_token_hash: hashResetToken(token), reset_token_expires: { gt: new Date() }, etat: 'ACTIF' },
    });
    if (!user) { res.status(400).json({ success: false, message: 'Lien de réinitialisation invalide ou expiré' }); return; }

    await prisma.utilisateur.update({
      where: { id: user.id },
      data: {
        password_hash: await bcrypt.hash(password, 12),
        reset_token_hash: null,
        reset_token_expires: null,
        refresh_token: null, // invalide toute session active (force une reconnexion avec le nouveau mot de passe)
        updated_by: user.id,
      },
    });
    void sendPasswordChangedEmail({ to: user.email, prenom: user.prenom });
    res.json({ success: true, message: 'Mot de passe réinitialisé avec succès' });
  } catch (err) {
    console.error('[AUTH/RESET-PASSWORD]', err);
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

// Gestion complète des utilisateurs (liste/création/édition/suppression) : voir
// server/src/modules/users/user.routes.ts (monté sur /api/users). Ce module reste
// dédié à l'authentification (login/refresh/logout/me).

export default router;

