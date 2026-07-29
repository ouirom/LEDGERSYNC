import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer';
import prisma from '../../config/db';
import { authenticate, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

// ── GET /api/reports/pv/:rapprochement_id ──────────────────
// Génère le PV de rapprochement en PDF via Puppeteer
router.get('/pv/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'] as string);

  try {
    const rapprochement = await prisma.rapprochement.findFirst({
      where: { id, entreprise: { tenant_id: req.user!.tenantId } },
      include: {
        entreprise: { include: { pays: true, theme: true } },
        compte_bancaire: { include: { banque: true } },
        justificatifs: true,
      },
    });

    if (!rapprochement) { res.status(404).json({ success: false, message: 'Rapprochement non trouvé' }); return; }
    if (!['VALIDE_FINAL', 'CLOS'].includes(rapprochement.statut)) {
      res.status(409).json({ success: false, message: 'Le PV officiel ne peut être généré qu\'après validation finale (DAF)' }); return;
    }

    const ecrituresLettrees = await prisma.ecritureComptable.count({
      where: { compte_bancaire_id: rapprochement.compte_bancaire_id, lettree: true, periode_mois: rapprochement.periode_mois, periode_annee: rapprochement.periode_annee },
    });
    const relevesLettres = await prisma.releveBancaireLigne.count({
      where: { compte_bancaire_id: rapprochement.compte_bancaire_id, lettree: true },
    });

    const moisNoms = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const moisNom = moisNoms[rapprochement.periode_mois - 1];

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; font-size: 11pt; color: #1a1a2e; background: white; }
  .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); color: white; padding: 30px 40px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 20pt; font-weight: 700; letter-spacing: 2px; }
  .header .sub { font-size: 9pt; opacity: 0.8; margin-top: 4px; }
  .header .logo-area { text-align: right; }
  .badge { background: #e94560; color: white; padding: 4px 12px; border-radius: 20px; font-size: 8pt; font-weight: 600; display: inline-block; margin-top: 8px; }
  .content { padding: 30px 40px; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 12pt; font-weight: 700; color: #0f3460; border-bottom: 2px solid #0f3460; padding-bottom: 6px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .info-box { background: #f8f9ff; border: 1px solid #e0e4f7; border-radius: 8px; padding: 12px 16px; }
  .info-box label { font-size: 8pt; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 2px; }
  .info-box value { font-size: 11pt; font-weight: 600; color: #1a1a2e; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #0f3460; color: white; padding: 8px 10px; text-align: left; font-size: 9pt; }
  td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-size: 9pt; }
  tr:nth-child(even) td { background: #f8f9ff; }
  .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .kpi { background: linear-gradient(135deg, #0f3460, #16213e); color: white; border-radius: 10px; padding: 14px; text-align: center; }
  .kpi .val { font-size: 20pt; font-weight: 700; }
  .kpi .lbl { font-size: 8pt; opacity: 0.8; margin-top: 2px; }
  .statut-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 8pt; font-weight: 600; }
  .statut-VALIDE { background: #d1fae5; color: #065f46; }
  .statut-SOUMIS { background: #fef3c7; color: #92400e; }
  .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 40px; }
  .sig-box { border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; text-align: center; min-height: 100px; }
  .sig-box .role { font-size: 8pt; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 60px; }
  .sig-box .name { font-size: 9pt; font-weight: 600; border-top: 1px solid #9ca3af; padding-top: 8px; margin-top: auto; }
  .footer { background: #f8f9ff; border-top: 2px solid #0f3460; padding: 12px 40px; text-align: center; font-size: 8pt; color: #6b7280; }
  .ecart { color: ${Math.abs(Number(rapprochement.montant_ecart)) < 0.01 ? '#065f46' : '#dc2626'}; font-weight: 700; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div style="font-size:9pt;opacity:0.7;margin-bottom:4px;">PROCÈS-VERBAL DE RAPPROCHEMENT BANCAIRE</div>
    <h1>LEDGERSYNC</h1>
    <div class="sub">${rapprochement.entreprise.nom} — ${rapprochement.entreprise.pays?.nom || ''}</div>
    <div class="badge">DOCUMENT OFFICIEL</div>
  </div>
  <div class="logo-area">
    <div style="font-size:24pt;font-weight:700;">${moisNom} ${rapprochement.periode_annee}</div>
    <div style="font-size:9pt;opacity:0.7;margin-top:4px;">Généré le ${new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })}</div>
    <div style="font-size:9pt;opacity:0.7;">N° RFP-${String(rapprochement.id).padStart(6,'0')}</div>
  </div>
</div>

<div class="content">
  <!-- KPIs -->
  <div class="kpi-row">
    <div class="kpi"><div class="val">${ecrituresLettrees}</div><div class="lbl">Écritures lettrées</div></div>
    <div class="kpi"><div class="val">${relevesLettres}</div><div class="lbl">Lignes relevé lettrées</div></div>
    <div class="kpi"><div class="val"><span class="ecart">${Number(rapprochement.montant_ecart).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</span></div><div class="lbl">Écart résiduel</div></div>
    <div class="kpi"><div class="val"><span class="statut-badge statut-${rapprochement.statut}">${rapprochement.statut}</span></div><div class="lbl">Statut</div></div>
  </div>

  <!-- Informations -->
  <div class="section">
    <div class="section-title">Informations Générales</div>
    <div class="grid-2">
      <div class="info-box"><label>Entreprise</label><value>${rapprochement.entreprise.nom}</value></div>
      <div class="info-box"><label>Période</label><value>${moisNom} ${rapprochement.periode_annee}</value></div>
      <div class="info-box"><label>Compte Bancaire</label><value>${rapprochement.compte_bancaire.intitule} — ${rapprochement.compte_bancaire.numero_compte}</value></div>
      <div class="info-box"><label>Banque</label><value>${rapprochement.compte_bancaire.banque.nom}</value></div>
    </div>
  </div>

  <!-- Signatures -->
  <div class="section">
    <div class="section-title">Signatures & Validations</div>
    <div class="signatures">
      <div class="sig-box">
        <div class="role">Préparateur</div>
        <div class="name">__________________________</div>
      </div>
      <div class="sig-box">
        <div class="role">Superviseur / Contrôleur</div>
        <div class="name">__________________________</div>
      </div>
      <div class="sig-box">
        <div class="role">Directeur Administratif & Financier</div>
        <div class="name">__________________________</div>
      </div>
    </div>
  </div>
</div>

<div class="footer">
  Document généré automatiquement par LedgerSync® — Confidentiel — ${new Date().toISOString()}
</div>
</body>
</html>`;

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
    await browser.close();

    // Sauvegarder l'URL du PV
    const pvFileName = `pv_${id}_${Date.now()}.pdf`;
    const pvPath = path.join(process.env.UPLOAD_DIR || './uploads', pvFileName);
    fs.writeFileSync(pvPath, pdfBuffer);

    await prisma.rapprochement.update({
      where: { id },
      data: {
        pv_url: `/uploads/${pvFileName}`,
        // Le PV officiel ne peut être généré qu'après validation finale (DAF) — sa génération clôt le rapprochement
        ...(rapprochement.statut === 'VALIDE_FINAL' ? { statut: 'CLOS' } : {}),
        updated_by: req.user!.userId,
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PV_Rapprochement_${moisNom}_${rapprochement.periode_annee}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[REPORTS/PV]', err);
    res.status(500).json({ success: false, message: 'Erreur lors de la génération du PV' });
  }
});

// GET /api/reports/audit-export — Export CSV piste d'audit
router.get('/audit-export', async (req: AuthRequest, res: Response): Promise<void> => {
  const { date_debut, date_fin, entite } = req.query;
  try {
    const logs = await prisma.logTraitement.findMany({
      where: {
        tenant_id: req.user!.tenantId,
        ...(entite ? { entite: entite as string } : {}),
        created_at: {
          gte: date_debut ? new Date(date_debut as string) : undefined,
          lte: date_fin ? new Date(date_fin as string) : undefined,
        },
      },
      orderBy: { created_at: 'desc' },
      take: 10000,
    });

    const csvLines = ['ID,Entite,Action,Entite_ID,Utilisateur_ID,IP,Date'];
    logs.forEach(l => {
      csvLines.push(`${l.id},"${l.entite}","${l.action}",${l.entite_id ?? ''},${l.utilisateur_id ?? ''},"${l.ip_address ?? ''}","${l.created_at.toISOString()}"`);
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit_trail.csv"');
    res.send('\uFEFF' + csvLines.join('\n'));
  } catch {
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

// GET /api/reports/dashboard-summary — KPIs agrégés pour le tableau de bord
router.get('/dashboard-summary', async (req: AuthRequest, res: Response): Promise<void> => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  try {
    const [
      totalEcritures,
      ecrituresLettrees,
      jobsEnCours,
      rapprochementsOuverts,
      rapprochementsValides,
      logsMois,
    ] = await Promise.all([
      prisma.ecritureComptable.count({
        where: {
          entreprise: { tenant_id: req.user!.tenantId },
          periode_mois: currentMonth,
          periode_annee: currentYear,
          etat: { not: 'ANNULE' },
        },
      }),
      prisma.ecritureComptable.count({
        where: {
          entreprise: { tenant_id: req.user!.tenantId },
          periode_mois: currentMonth,
          periode_annee: currentYear,
          lettree: true,
        },
      }),
      prisma.jobTraitement.count({
        where: { tenant_id: req.user!.tenantId, statut: { in: ['EN_COURS', 'EN_ATTENTE'] } },
      }),
      prisma.rapprochement.count({
        where: {
          entreprise: { tenant_id: req.user!.tenantId },
          statut: { in: ['BROUILLON', 'EN_COURS', 'SOUMIS'] },
          periode_mois: currentMonth,
          periode_annee: currentYear,
        },
      }),
      prisma.rapprochement.count({
        where: {
          entreprise: { tenant_id: req.user!.tenantId },
          statut: { in: ['VALIDE_FINAL', 'CLOS'] },
          periode_mois: currentMonth,
          periode_annee: currentYear,
        },
      }),
      prisma.logTraitement.count({
        where: {
          tenant_id: req.user!.tenantId,
          created_at: { gte: new Date(currentYear, currentMonth - 1, 1) },
        },
      }),
    ]);

    const tauxLettrage = totalEcritures > 0
      ? Math.round((ecrituresLettrees / totalEcritures) * 100 * 10) / 10
      : 0;

    res.json({
      success: true,
      data: {
        periode: { mois: currentMonth, annee: currentYear },
        ecritures: { total: totalEcritures, lettrees: ecrituresLettrees, tauxLettrage },
        jobs: { enCours: jobsEnCours },
        rapprochements: { ouverts: rapprochementsOuverts, valides: rapprochementsValides },
        audit: { logsThisMois: logsMois },
      },
    });
  } catch (err) {
    console.error('[REPORTS/DASHBOARD]', err);
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

export default router;
