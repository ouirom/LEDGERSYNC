// Génère des fichiers d'exemple pour tester manuellement l'import de relevés
// bancaires (page Réglages > Import Excel), dans tous les formats et
// configurations de colonnes supportés. Régénérer avec :
//   npx tsx scripts/generate_sample_releves.ts
import fs from 'fs';
import path from 'path';
import writeExcelFile from 'write-excel-file/node';
import puppeteer from 'puppeteer';

const OUT_DIR = path.join(__dirname, '..', 'sample-data', 'releves');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── 1. CSV — colonne Montant signée (négatif = débit) ────────
const csvMontantSigne = [
  'Date;Libelle;Date valeur;Montant',
  '01/08/2026;VIR FOURNISSEUR ACME SARL;01/08/2026;-125000',
  '03/08/2026;ENCAISSEMENT CLIENT NDIAYE;04/08/2026;340000',
  '07/08/2026;FRAIS TENUE DE COMPTE;07/08/2026;-7500',
  '10/08/2026;VIR SALAIRE PERSONNEL;10/08/2026;-890000',
  '15/08/2026;REMISE CHEQUE CLIENT DIOP;16/08/2026;215000',
].join('\n');
fs.writeFileSync(path.join(OUT_DIR, '01_montant_signe.csv'), csvMontantSigne, 'utf8');

// ── 2. CSV — colonnes Débit/Crédit séparées ───────────────────
const csvDebitCredit = [
  'Date;Libelle;Date valeur;Debit;Credit',
  '02/08/2026;ACHAT FOURNITURES BUREAU;02/08/2026;45000;',
  '05/08/2026;VIREMENT RECU CLIENT SARR;05/08/2026;;560000',
  '09/08/2026;PRELEVEMENT ASSURANCE;09/08/2026;32000;',
  '12/08/2026;REMBOURSEMENT TVA;13/08/2026;;125000',
  '18/08/2026;COMMISSION BANCAIRE;18/08/2026;3500;',
].join('\n');
fs.writeFileSync(path.join(OUT_DIR, '02_debit_credit.csv'), csvDebitCredit, 'utf8');

// ── 3. Excel — colonne Montant signée ─────────────────────────
async function generateExcel() {
  const rows = [
    ['Date', 'Libelle', 'Date valeur', 'Montant'],
    ['01/08/2026', 'VIR FOURNISSEUR EXCEL TEST', '01/08/2026', -98000],
    ['04/08/2026', 'ENCAISSEMENT CLIENT EXCEL', '05/08/2026', 410000],
    ['11/08/2026', 'FRAIS BANCAIRES', '11/08/2026', -4200],
    ['20/08/2026', 'VIREMENT FOURNISSEUR B', '20/08/2026', -156000],
  ];
  await writeExcelFile(rows).toFile(path.join(OUT_DIR, '03_montant_signe.xlsx'));
}

// ── 4. PDF — deux fichiers distincts représentant les 2 pages d'un même relevé ──
function pdfPageHtml(title: string, rows: Array<[string, string, string, string, string]>): string {
  const trs = rows.map(([date, libelle, valeur, debit, credit]) => `
    <tr>
      <td style="padding: 4px 40px 4px 0;">${date}</td>
      <td style="padding: 4px 40px 4px 0;">${libelle}</td>
      <td style="padding: 4px 40px 4px 0;">${valeur}</td>
      <td style="padding: 4px 40px 4px 0;">${debit}</td>
      <td style="padding: 4px 0;">${credit}</td>
    </tr>`).join('');
  return `
  <html><body style="font-family: Arial; font-size: 12px;">
    <h2>${title}</h2>
    <table style="border-spacing: 0;">
      <thead><tr>
        <th style="padding: 4px 40px 4px 0; text-align:left;">Date</th>
        <th style="padding: 4px 40px 4px 0; text-align:left;">Libelle</th>
        <th style="padding: 4px 40px 4px 0; text-align:left;">Date valeur</th>
        <th style="padding: 4px 40px 4px 0; text-align:left;">Debit</th>
        <th style="padding: 4px 0; text-align:left;">Credit</th>
      </tr></thead>
      <tbody>${trs}</tbody>
    </table>
  </body></html>`;
}

function pdfMultiInternalPageHtml(): string {
  return `
  <html><body style="font-family: Arial; font-size: 12px;">
    <div>
      <h2>Relevé de compte — Page 1</h2>
      <table style="border-spacing: 0;">
        <thead><tr>
          <th style="padding: 4px 40px 4px 0; text-align:left;">Date</th>
          <th style="padding: 4px 40px 4px 0; text-align:left;">Libelle</th>
          <th style="padding: 4px 0; text-align:left;">Montant</th>
        </tr></thead>
        <tbody>
          <tr><td style="padding: 4px 40px 4px 0;">01/08/2026</td><td style="padding: 4px 40px 4px 0;">OPERATION DEBUT DE MOIS</td><td style="padding: 4px 0;">-52000</td></tr>
          <tr><td style="padding: 4px 40px 4px 0;">08/08/2026</td><td style="padding: 4px 40px 4px 0;">ENCAISSEMENT SEMAINE 1</td><td style="padding: 4px 0;">180000</td></tr>
        </tbody>
      </table>
    </div>
    <div style="page-break-before: always;">
      <h2>Relevé de compte — Page 2 (suite, en-tête non répété)</h2>
      <table style="border-spacing: 0;">
        <tbody>
          <tr><td style="padding: 4px 40px 4px 0;">16/08/2026</td><td style="padding: 4px 40px 4px 0;">ENCAISSEMENT SEMAINE 2</td><td style="padding: 4px 0;">95000</td></tr>
          <tr><td style="padding: 4px 40px 4px 0;">25/08/2026</td><td style="padding: 4px 40px 4px 0;">FRAIS FIN DE MOIS</td><td style="padding: 4px 0;">-6800</td></tr>
        </tbody>
      </table>
    </div>
  </body></html>`;
}

async function generatePdfs() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page1 = await browser.newPage();
    await page1.setContent(pdfPageHtml('Relevé de compte — Page 1 sur 2', [
      ['01/08/2026', 'VIR FOURNISSEUR PDF SARL', '01/08/2026', '65 000,00', ''],
      ['06/08/2026', 'ENCAISSEMENT CLIENT PDF', '07/08/2026', '', '275 000,00'],
    ]));
    await page1.pdf({ path: path.join(OUT_DIR, '04a_pdf_page1.pdf'), format: 'A4', printBackground: true });
    await page1.close();

    const page2 = await browser.newPage();
    await page2.setContent(pdfPageHtml('Relevé de compte — Page 2 sur 2', [
      ['14/08/2026', 'PRELEVEMENT ASSURANCE PDF', '14/08/2026', '18 500,00', ''],
      ['22/08/2026', 'VIREMENT RECU FOURNISSEUR', '23/08/2026', '', '132 000,00'],
    ]));
    await page2.pdf({ path: path.join(OUT_DIR, '04b_pdf_page2.pdf'), format: 'A4', printBackground: true });
    await page2.close();

    const page3 = await browser.newPage();
    await page3.setContent(pdfMultiInternalPageHtml());
    await page3.pdf({ path: path.join(OUT_DIR, '05_pdf_multipage_interne.pdf'), format: 'A4', printBackground: true });
    await page3.close();
  } finally {
    await browser.close();
  }
}

async function main() {
  await generateExcel();
  await generatePdfs();
  console.log('✅ Fichiers d\'exemple générés dans', OUT_DIR);
  for (const f of fs.readdirSync(OUT_DIR)) console.log('  -', f);
}

main().catch(err => { console.error(err); process.exit(1); });
