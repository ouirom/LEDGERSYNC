import nodemailer from 'nodemailer';
import prisma from '../config/db';

interface SendMailParams {
  to: string;
  subject: string;
  html: string;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

// La configuration SMTP est modifiable depuis l'UI (Paramètres > Email, table
// parametres_application) sans redémarrage : relue à chaque envoi plutôt que
// figée au démarrage du process. Les variables d'environnement ne servent que
// de valeurs par défaut tant qu'aucun réglage n'a été enregistré via l'UI.
async function getSmtpConfig(): Promise<SmtpConfig> {
  const rows = await prisma.parametreApplication.findMany({ where: { categorie: 'EMAIL', etat: 'ACTIF' } });
  const db = Object.fromEntries(rows.map(r => [r.cle, r.valeur]));
  return {
    host: db['smtp_host'] || process.env.SMTP_HOST || '',
    port: parseInt(db['smtp_port'] || process.env.SMTP_PORT || '587', 10),
    secure: (db['smtp_secure'] ?? process.env.SMTP_SECURE) === 'true',
    user: db['smtp_user'] || process.env.SMTP_USER || '',
    pass: db['smtp_pass'] || process.env.SMTP_PASS || '',
    from: db['smtp_from'] || process.env.SMTP_FROM || 'LedgerSync <no-reply@ledgersync.demo>',
  };
}

function buildTransporter(cfg: SmtpConfig) {
  // En développement (ou tant que le SMTP n'est pas configuré), on ne bloque jamais
  // le flux applicatif faute de serveur mail réel : les emails sont simplement
  // journalisés dans la console (jsonTransport) au lieu d'être envoyés.
  return cfg.host
    ? nodemailer.createTransport({
        host: cfg.host, port: cfg.port, secure: cfg.secure, auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
        // Échec rapide sur un hôte injoignable/mal saisi plutôt que d'attendre le
        // timeout DNS/TCP par défaut (jusqu'à plusieurs dizaines de secondes) —
        // important pour le bouton « Tester l'envoi » des paramètres.
        connectionTimeout: 10000,
      })
    : nodemailer.createTransport({ jsonTransport: true });
}

// L'envoi ne doit jamais faire échouer l'action métier qui le déclenche
// (création de compte, demande de réinitialisation...) : les erreurs sont
// journalisées mais avalées ici plutôt que propagées à l'appelant.
export async function sendMail({ to, subject, html }: SendMailParams): Promise<void> {
  try {
    await sendMailStrict({ to, subject, html });
  } catch (err) {
    console.error('[MAILER] Échec de l\'envoi de l\'email:', err);
  }
}

// Variante qui propage les erreurs — utilisée par l'action « Tester l'envoi »
// des paramètres email, où l'utilisateur a justement besoin de savoir si ça a
// échoué plutôt que de voir l'erreur avalée silencieusement.
export async function sendMailStrict({ to, subject, html }: SendMailParams): Promise<void> {
  const cfg = await getSmtpConfig();
  const transporter = buildTransporter(cfg);
  const info = await transporter.sendMail({ from: cfg.from, to, subject, html });
  if (!cfg.host) {
    console.log(`📧 [DEV] SMTP non configuré — email journalisé (non envoyé) → ${to} : "${subject}"`);
    console.log(info.message?.toString());
  }
}

function layout(title: string, bodyHtml: string): string {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
    <div style="background: #0f3460; padding: 20px 24px; border-radius: 10px 10px 0 0;">
      <span style="color: #fff; font-size: 18px; font-weight: 700;">LedgerSync</span>
    </div>
    <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px; padding: 24px;">
      <h2 style="margin: 0 0 16px; font-size: 17px; color: #0f3460;">${title}</h2>
      ${bodyHtml}
    </div>
    <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 16px;">
      LedgerSync — ERP Rapprochement Bancaire. Cet email est généré automatiquement, merci de ne pas y répondre.
    </p>
  </div>`;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN_TENANT: 'Admin Tenant', DAF: 'DAF',
  MANAGER: 'Manager', SUPERVISEUR: 'Superviseur', USER: 'Utilisateur', AUDITEUR: 'Auditeur',
};

export async function sendAccountCreatedEmail(params: { to: string; prenom: string; nom: string; role: string; entreprise?: string | null }): Promise<void> {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const html = layout('Votre compte a été créé', `
    <p>Bonjour ${params.prenom} ${params.nom},</p>
    <p>Un compte LedgerSync vient d'être créé pour vous${params.entreprise ? ` au sein de <strong>${params.entreprise}</strong>` : ''}, avec le rôle <strong>${ROLE_LABELS[params.role] || params.role}</strong>.</p>
    <p>Identifiant de connexion : <strong>${params.to}</strong></p>
    <p>Le mot de passe initial vous a été communiqué séparément par votre administrateur. Si vous ne l'avez pas reçu, utilisez le lien « Mot de passe oublié » sur la page de connexion.</p>
    <p style="margin-top: 20px;">
      <a href="${clientUrl}/login" style="background: #e94560; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 13px;">Se connecter</a>
    </p>
  `);
  await sendMail({ to: params.to, subject: 'Votre compte LedgerSync a été créé', html });
}

export async function sendPasswordResetEmail(params: { to: string; prenom: string; resetUrl: string }): Promise<void> {
  const html = layout('Réinitialisation de votre mot de passe', `
    <p>Bonjour ${params.prenom},</p>
    <p>Une demande de réinitialisation de mot de passe a été effectuée pour votre compte LedgerSync (${params.to}).</p>
    <p>Ce lien est valable <strong>1 heure</strong>. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email — votre mot de passe restera inchangé.</p>
    <p style="margin-top: 20px;">
      <a href="${params.resetUrl}" style="background: #e94560; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 13px;">Réinitialiser mon mot de passe</a>
    </p>
    <p style="font-size: 11px; color: #64748b; margin-top: 16px;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>${params.resetUrl}</p>
  `);
  await sendMail({ to: params.to, subject: 'Réinitialisation de votre mot de passe LedgerSync', html });
}

export async function sendPasswordChangedEmail(params: { to: string; prenom: string }): Promise<void> {
  const html = layout('Votre mot de passe a été modifié', `
    <p>Bonjour ${params.prenom},</p>
    <p>Le mot de passe de votre compte LedgerSync (${params.to}) vient d'être modifié.</p>
    <p>Si vous n'êtes pas à l'origine de ce changement, contactez immédiatement votre administrateur.</p>
  `);
  await sendMail({ to: params.to, subject: 'Votre mot de passe LedgerSync a été modifié', html });
}
