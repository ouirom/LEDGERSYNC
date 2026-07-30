import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/db';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { createAuditEntry } from '../../middleware/auditLogger';
import { sendMailStrict } from '../../utils/mailer';

const router = Router();
// Paramètres d'infrastructure globaux à l'instance (ex. SMTP) : réservés au
// SUPER_ADMIN, contrairement aux réglages tenant/entreprise (thèmes, périodes...)
// gérés ailleurs et ouverts à ADMIN_TENANT.
router.use(authenticate, authorize('SUPER_ADMIN'));

// Clés dont la valeur ne doit jamais être renvoyée en clair au client une fois
// enregistrée (ex. mot de passe SMTP) : uniquement un indicateur "configuré".
const SENSITIVE_KEYS = new Set(['smtp_pass']);
const MASK = '••••••••';

const putSchema = z.object({ valeurs: z.record(z.string(), z.string()) });

// GET /api/parametres/:categorie
router.get('/:categorie', async (req: AuthRequest, res: Response): Promise<void> => {
  const categorie = req.params['categorie']!.toUpperCase();
  try {
    const rows = await prisma.parametreApplication.findMany({ where: { categorie, etat: 'ACTIF' } });
    const data: Record<string, string | null> = {};
    for (const r of rows) {
      data[r.cle] = SENSITIVE_KEYS.has(r.cle) ? (r.valeur ? MASK : null) : r.valeur;
    }
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// PUT /api/parametres/:categorie — met à jour uniquement les clés fournies.
// Pour une clé sensible, envoyer la valeur MASK (ou l'omettre) conserve la
// valeur déjà enregistrée — seule une vraie nouvelle valeur la remplace.
router.put('/:categorie', async (req: AuthRequest, res: Response): Promise<void> => {
  const categorie = req.params['categorie']!.toUpperCase();
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }

  try {
    const avant = await prisma.parametreApplication.findMany({ where: { categorie } });
    const entries = Object.entries(parsed.data.valeurs).filter(([cle, valeur]) => !(SENSITIVE_KEYS.has(cle) && valeur === MASK));

    await Promise.all(entries.map(([cle, valeur]) =>
      prisma.parametreApplication.upsert({
        where: { categorie_cle: { categorie, cle } },
        update: { valeur, etat: 'ACTIF', updated_by: req.user!.userId },
        create: { categorie, cle, valeur, etat: 'ACTIF', created_by: req.user!.userId, updated_by: req.user!.userId },
      })
    ));

    await createAuditEntry({
      tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'PARAMETRE_APPLICATION', action: 'UPDATE',
      motif: categorie,
      avant: Object.fromEntries(avant.map(a => [a.cle, SENSITIVE_KEYS.has(a.cle) ? (a.valeur ? MASK : null) : a.valeur])),
      apres: Object.fromEntries(entries.map(([cle, valeur]) => [cle, SENSITIVE_KEYS.has(cle) ? MASK : valeur])),
      ipAddress: req.ip,
    });
    res.json({ success: true, message: 'Paramètres enregistrés' });
  } catch (err) {
    console.error('[PARAMETRES/PUT]', err);
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

// POST /api/parametres/email/test — envoie un email de test avec la
// configuration SMTP actuellement enregistrée (pas celle du formulaire en
// cours d'édition), à l'adresse de l'administrateur connecté.
router.post('/email/test', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await sendMailStrict({
      to: req.user!.email,
      subject: 'LedgerSync — Email de test',
      html: '<p>Ceci est un email de test envoyé depuis les paramètres de configuration email de LedgerSync. Si vous le recevez, la configuration SMTP fonctionne correctement.</p>',
    });
    res.json({ success: true, message: `Email de test envoyé à ${req.user!.email}` });
  } catch (err) {
    console.error('[PARAMETRES/EMAIL-TEST]', err);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi de l\'email de test' });
  }
});

export default router;
