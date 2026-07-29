/**
 * Générateur de fichiers d'exercice LedgerSync
 * Crée des fichiers Excel (.xlsx) de relevés bancaires et écritures comptables
 * pour tester l'import et le rapprochement.
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(__dirname, '../../exercices');

// ── Helpers ────────────────────────────────────────────────
const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const rndF = (min: number, max: number) => parseFloat((Math.random() * (max - min) + min).toFixed(2));
const pad2 = (n: number) => String(n).padStart(2, '0');
const dateStr = (y: number, m: number, d: number) => `${pad2(d)}/${pad2(m)}/${y}`;

const LIBELLES_CREDIT = [
  'VIR RECU CLIENT ACME CORP',
  'VIR RECU NDOX SARL CMD-2026',
  'ENCAISSEMENT CHQ GLOBEXCO',
  'VIR RECU SYSCOM INDUSTRIES',
  'REMBOURSEMENT TVA DGID',
  'VIR RECU ORANGE MONEY PARTENAIRE',
  'ENCAISSEMENT LOYER IMMEUBLE A',
  'VIR RECU SOTELMA FACTURATION',
  'CREDIT VENTE MARCHANDISES REF-789',
  'VIR RECU SOCIÉTÉ GÉNÉRALE DAKAR',
  'ENCAISSEMENT PRESTATION SERVICE',
  'REMBOURSEMENT TROP-PERÇU ÉTAT',
  'VIR RECU TOTAL ENERGIE CMD',
  'SUBVENTION AGENCE NATIONALE',
  'VIR RECU CORIS BANK COMPENSAT.',
];

const LIBELLES_DEBIT = [
  'VIR FOURNISSEUR SARL TECHNO',
  'PAIEMENT LOYER BUREAU PRINCIPAL',
  'SALAIRES OCTOBRE 2026',
  'PAIEMENT COTISATIONS IPRES/CSS',
  'RÈGLEMENT FACTURE EAU SDE',
  'PAIEMENT ÉLECTRICITÉ SENELEC',
  'VIR FOURNISSEUR MATÉRIEL INFO',
  'FRAIS BANCAIRES GESTION COMPTE',
  'COMMISSIONNEMENT AGENT COMMERCIAL',
  'PAIEMENT ASSURANCE AXA SÉNÉGAL',
  'REMBOURSEMENT PRÊT BANQUE MOIS',
  'ACHAT FOURNITURES DE BUREAU',
  'PAIEMENT ABONNEMENT LOGICIELS',
  'VIR FOURNISSEUR CARBURANT',
  'RÈGLEMENT FACTURE IMPRIMERIE',
];

const REFS_CREDIT = ['REC', 'VIR', 'ENC', 'RMB'];
const REFS_DEBIT  = ['FAC', 'PAY', 'VIR', 'CHQ'];

const makeRef = (prefix: string, idx: number) => `${prefix}-2026-${String(idx).padStart(4, '0')}`;

interface LigneReleve {
  Date: string;
  'Date valeur': string;
  Reference: string;
  Libelle: string;
  Montant: number;
  Devise: string;
  Solde?: number;
}

interface LigneEcriture {
  Date: string;
  Reference: string;
  Libelle: string;
  Montant: number;
  Type: string;
  'Compte Bancaire'?: string;
  'Periode Mois': number;
  'Periode Annee': number;
}

// ── Génère un mois de données ──────────────────────────────
function genererMois(annee: number, mois: number, nbLignes: number) {
  const releve: LigneReleve[] = [];
  const ecritures: LigneEcriture[] = [];
  let solde = 48_750_000;
  let idxCredit = 1, idxDebit = 1;

  for (let i = 0; i < nbLignes; i++) {
    const jour = rnd(1, 28);
    const isCredit = Math.random() > 0.45;
    const montant = isCredit ? rndF(200_000, 8_000_000) : rndF(50_000, 5_000_000);
    const libReleve = isCredit ? LIBELLES_CREDIT[rnd(0, LIBELLES_CREDIT.length - 1)] : LIBELLES_DEBIT[rnd(0, LIBELLES_DEBIT.length - 1)];
    const prefRel = isCredit ? REFS_CREDIT[rnd(0, 3)] : REFS_DEBIT[rnd(0, 3)];
    const ref = makeRef(prefRel, i + 1);
    const dateVal = jour + rnd(1, 2);
    const dateValFinal = Math.min(dateVal, 28);

    // Ligne relevé bancaire
    releve.push({
      Date: dateStr(annee, mois, jour),
      'Date valeur': dateStr(annee, mois, dateValFinal),
      Reference: `OP-${mois}${String(i + 1).padStart(3, '0')}`,
      Libelle: libReleve,
      Montant: isCredit ? montant : -montant,
      Devise: 'XOF',
      Solde: (solde += isCredit ? montant : -montant),
    });

    // Écriture comptable correspondante (85% de lettrage possible, 15% de décalage)
    const hasMatch = Math.random() > 0.15;
    const libelleEcriture = hasMatch
      ? libReleve.replace('VIR RECU', 'RÈGLEMENT').replace('ENCAISSEMENT', 'RECETTE')
      : (isCredit ? LIBELLES_CREDIT[rnd(0, LIBELLES_CREDIT.length - 1)] : LIBELLES_DEBIT[rnd(0, LIBELLES_DEBIT.length - 1)]);
    const montantEcriture = hasMatch ? montant + (Math.random() > 0.9 ? rndF(0, 50) : 0) : rndF(100_000, 6_000_000);
    const jourEcriture = hasMatch ? Math.max(1, jour - rnd(0, 2)) : rnd(1, 28);

    ecritures.push({
      Date: dateStr(annee, mois, jourEcriture),
      Reference: ref,
      Libelle: libelleEcriture,
      Montant: montantEcriture,
      Type: isCredit ? 'CREDIT' : 'DEBIT',
      'Compte Bancaire': 'Compte Principal XOF',
      'Periode Mois': mois,
      'Periode Annee': annee,
    });
  }

  // Ajouter quelques lignes "orphelines" côté relevé (frais bancaires, intérêts)
  const orphelins = [
    { lib: 'FRAIS TENUE DE COMPTE TRIM.', montant: 15000 },
    { lib: 'COMMISSION VIREMENT ÉTRANGER', montant: 8500 },
    { lib: 'INTÉRÊTS DÉBITEURS MOIS', montant: 22000 },
  ];
  orphelins.forEach((o, i) => {
    releve.push({
      Date: dateStr(annee, mois, 28),
      'Date valeur': dateStr(annee, mois, 28),
      Reference: `FRAIS-${pad2(mois)}-${i + 1}`,
      Libelle: o.lib,
      Montant: -o.montant,
      Devise: 'XOF',
    });
  });

  return { releve: releve.sort((a, b) => parseInt(a.Date.split('/')[0]) - parseInt(b.Date.split('/')[0])), ecritures };
}

// ── Écrire un fichier Excel ────────────────────────────────
function ecrireExcel(nomFichier: string, feuilles: Record<string, object[]>) {
  const wb = XLSX.utils.book_new();
  for (const [nom, data] of Object.entries(feuilles)) {
    const ws = XLSX.utils.json_to_sheet(data);
    // Largeurs colonnes
    ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 45 }, { wch: 15 }, { wch: 8 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, nom);
  }
  const filePath = path.join(OUTPUT_DIR, nomFichier);
  XLSX.writeFile(wb, filePath);
  console.log(`✅ ${nomFichier} (${feuilles[Object.keys(feuilles)[0]].length} lignes)`);
  return filePath;
}

// ── Générer les fichiers CSV aussi ────────────────────────
function ecrireCSV(nomFichier: string, data: object[]) {
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const filePath = path.join(OUTPUT_DIR, nomFichier);
  fs.writeFileSync(filePath, '\uFEFF' + csv, 'utf8'); // BOM pour Excel
  console.log(`✅ ${nomFichier} (CSV, ${data.length} lignes)`);
}

// ── MAIN ──────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('\n📁 Génération des fichiers d\'exercice LedgerSync...\n');

  // ── 1. Relevé bancaire simple — 50 lignes (juillet 2026) ─
  const { releve: rel50, ecritures: ecr50 } = genererMois(2026, 7, 50);
  ecrireExcel('releve_banque_juillet_2026_50lignes.xlsx', { 'Relevé Juillet 2026': rel50 });
  ecrireCSV('releve_banque_juillet_2026_50lignes.csv', rel50);

  // ── 2. Relevé bancaire moyen — 200 lignes (6 mois) ───────
  const releveMulti: LigneReleve[] = [];
  for (let m = 2; m <= 7; m++) {
    const { releve } = genererMois(2026, m, 33);
    releveMulti.push(...releve);
  }
  ecrireExcel('releve_banque_S1_2026_200lignes.xlsx', { 'Relevé S1 2026': releveMulti });

  // ── 3. Gros fichier — 2 000 lignes (stress test BullMQ) ──
  const releveGros: LigneReleve[] = [];
  for (let m = 1; m <= 12; m++) {
    const { releve } = genererMois(2026, m, 166);
    releveGros.push(...releve);
  }
  ecrireExcel('releve_banque_annee_2026_2000lignes.xlsx', { 'Relevé Annuel 2026': releveGros });
  console.log(`   → Fichier stress test : ${releveGros.length} lignes`);

  // ── 4. Fichier d'écritures comptables — juillet 2026 ─────
  const { ecritures: ecr } = genererMois(2026, 7, 50);
  ecrireExcel('ecritures_comptables_juillet_2026.xlsx', { 'Écritures Juillet': ecr });

  // ── 5. Fichier pré-lettré — correspondances évidentes ────
  const preLettreReleve: LigneReleve[] = [];
  const preLettreEcritures: LigneEcriture[] = [];
  const montantsExacts = [1_500_000, 2_800_000, 450_000, 3_200_000, 5_600_000, 890_000, 125_000, 680_000, 340_000, 2_100_000];
  montantsExacts.forEach((montant, i) => {
    const jour = rnd(1, 25);
    const isCredit = i % 2 === 1;
    const ref = `EXACT-${String(i + 1).padStart(3, '0')}`;
    preLettreReleve.push({
      Date: dateStr(2026, 7, jour),
      'Date valeur': dateStr(2026, 7, jour + 1),
      Reference: `OP-${String(i + 1).padStart(3, '0')}`,
      Libelle: isCredit ? `VIREMENT REÇU CLIENT ${ref}` : `RÈGLEMENT FOURNISSEUR ${ref}`,
      Montant: isCredit ? montant : -montant,
      Devise: 'XOF',
    });
    preLettreEcritures.push({
      Date: dateStr(2026, 7, jour),
      Reference: ref,
      Libelle: isCredit ? `RECETTE CLIENT ${ref}` : `CHARGE FOURNISSEUR ${ref}`,
      Montant: montant,
      Type: isCredit ? 'CREDIT' : 'DEBIT',
      'Compte Bancaire': 'Compte Principal XOF',
      'Periode Mois': 7,
      'Periode Annee': 2026,
    });
  });
  ecrireExcel('exercice_lettrage_parfait_juillet_2026.xlsx', {
    'Relevé Bancaire': preLettreReleve,
    'Écritures Comptables': preLettreEcritures,
  });

  // ── 6. Fichier avec écarts (tolérance) ───────────────────
  const avecEcarts: LigneReleve[] = [];
  const basesMontants = [500_000, 1_200_000, 750_000, 2_300_000, 3_100_000];
  basesMontants.forEach((base, i) => {
    const ecart = rnd(10, 100); // Micro-écart centimes
    avecEcarts.push({
      Date: dateStr(2026, 7, rnd(1, 25)),
      'Date valeur': dateStr(2026, 7, rnd(1, 25)),
      Reference: `ECT-${String(i + 1).padStart(3, '0')}`,
      Libelle: `VIREMENT AVEC ÉCART ${base.toLocaleString()} +${ecart} XOF`,
      Montant: i % 2 === 0 ? base + ecart : -(base + ecart),
      Devise: 'XOF',
    });
  });
  ecrireExcel('exercice_avec_ecarts_micro.xlsx', { 'Relevé avec Écarts': avecEcarts });

  // ── 7. Rapport README ─────────────────────────────────────
  const readme = `# Fichiers d'exercice — LedgerSync

Générés le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}

## Fichiers disponibles

| Fichier | Type | Lignes | Usage |
|---------|------|--------|-------|
| releve_banque_juillet_2026_50lignes.xlsx | Relevé bancaire | ~53 | Test import simple |
| releve_banque_juillet_2026_50lignes.csv | Relevé bancaire CSV | ~53 | Test import CSV |
| releve_banque_S1_2026_200lignes.xlsx | Relevé 6 mois | ~200 | Test multi-période |
| releve_banque_annee_2026_2000lignes.xlsx | Relevé annuel | ~2000 | Stress test BullMQ |
| ecritures_comptables_juillet_2026.xlsx | Écritures comptables | ~50 | Import écritures |
| exercice_lettrage_parfait_juillet_2026.xlsx | 2 feuilles | 10+10 | Lettrage exact 1:1 |
| exercice_avec_ecarts_micro.xlsx | Relevé écarts | 5 | Test tolérance micro-écart |

## Colonnes attendues pour l'import relevé

| Colonne | Description | Exemple |
|---------|-------------|---------|
| Date | Date opération JJ/MM/AAAA | 15/07/2026 |
| Date valeur | Date valeur | 16/07/2026 |
| Reference | Référence bancaire | OP-042 |
| Libelle | Description | VIR RECU CLIENT ACME |
| Montant | Positif = crédit, Négatif = débit | -1500000 |
| Devise | Devise | XOF |

## Comment utiliser

1. Démarrer l'application : http://localhost:5173
2. Se connecter : admin@ledgersync.demo / Admin@2026!
3. Aller dans **Rapprochement → Import Excel**
4. Sélectionner le compte "Compte Principal XOF"
5. Glisser-déposer un fichier .xlsx ou .csv
6. Observer la progression temps réel (nécessite Redis)

## Scénarios de test

- **Lettrage parfait** : Utiliser \`exercice_lettrage_parfait_juillet_2026.xlsx\`
  → Les 10 lignes relevé correspondent exactement aux 10 écritures
  
- **Stress test** : Utiliser \`releve_banque_annee_2026_2000lignes.xlsx\`
  → Teste le chunking BullMQ et la progression WebSocket
  
- **Micro-écarts** : Utiliser \`exercice_avec_ecarts_micro.xlsx\`
  → Teste l'apurement automatique sous le seuil de tolérance (0.05 XOF)
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'README.md'), readme, 'utf8');
  console.log('\n📋 README.md généré');
  console.log(`\n🎉 Tous les fichiers sont dans : ${OUTPUT_DIR}`);
  console.log('\nFichiers générés :');
  fs.readdirSync(OUTPUT_DIR).forEach(f => {
    const size = fs.statSync(path.join(OUTPUT_DIR, f)).size;
    console.log(`  📄 ${f} (${(size / 1024).toFixed(1)} KB)`);
  });
}

main().catch(console.error);
