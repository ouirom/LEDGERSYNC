import { readSheet } from 'read-excel-file/node';
import { PDFParse } from 'pdf-parse';
import fs from 'fs';
import path from 'path';

// Détecte le séparateur CSV (virgule ou point-virgule, courant dans les exports FR)
// en comptant les occurrences sur la ligne d'en-tête.
export function detectCsvDelimiter(headerLine: string): string {
  const commas = (headerLine.match(/,/g) || []).length;
  const semicolons = (headerLine.match(/;/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

export function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      result.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

export function parseCsv(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r\n|\n|\r/).filter(l => l.length > 0);
  if (lines.length === 0) return [];
  const delimiter = detectCsvDelimiter(lines[0]!);
  const headers = parseCsvLine(lines[0]!, delimiter).map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = parseCsvLine(line, delimiter);
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
    return row;
  });
}

const HEADER_KEYWORDS = ['date', 'libell', 'débit', 'debit', 'crédit', 'credit', 'montant', 'valeur', 'reference', 'référence'];
const isDateCell = (s: string) => /^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$/.test(s.trim());
// Nécessite deux décimales (toujours présentes sur un relevé bancaire) pour éviter
// de confondre un montant avec un simple numéro de pièce/référence courte.
const isAmountCell = (s: string) => /^-?\d{1,3}([ .,]\d{3})*[.,]\d{2}$/.test(s.trim());

// Reconstitue une ligne "canonique" {date, libelle, debit/credit ou montant} à partir
// d'une rangée de cellules brutes sans en-têtes reconnaissables (tableau PDF sans
// intitulés clairs, ou repli texte sur relevé sans grille visible) : la date et les
// montants sont repérés par leur forme, le reste des cellules forme le libellé.
function mapPositionalRow(cells: string[]): Record<string, unknown> {
  const trimmed = cells.map(c => (c ?? '').trim());
  const dateIdx = trimmed.findIndex(isDateCell);
  const amountIdxs = trimmed.reduce<number[]>((acc, c, i) => { if (isAmountCell(c)) acc.push(i); return acc; }, []);
  const libelle = trimmed.filter((c, i) => i !== dateIdx && !amountIdxs.includes(i) && c !== '').join(' ');
  const row: Record<string, unknown> = { date: dateIdx >= 0 ? trimmed[dateIdx] : '', libelle };
  if (amountIdxs.length >= 2) {
    row['debit'] = trimmed[amountIdxs[0]];
    row['credit'] = trimmed[amountIdxs[1]];
  } else if (amountIdxs.length === 1) {
    row['montant'] = trimmed[amountIdxs[0]];
  }
  return row;
}

function zipHeaderRow(headers: string[], cells: string[]): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
  return row;
}

const looksLikeHeaderRow = (cells: string[]) => cells.some(c => HEADER_KEYWORDS.some(k => c.toLowerCase().includes(k)));

// Le texte extrait d'un PDF ne conserve pas les cellules vides : lorsqu'une colonne
// Débit OU Crédit est vide sur une ligne, elle disparaît purement et simplement au
// lieu de laisser un "trou" — la cellule montant restante peut alors se retrouver
// alignée sur l'un ou l'autre en-tête au hasard. Sans coordonnées x/y réelles
// (indisponibles via l'extraction texte), impossible de départager les deux avec
// certitude : on marque ces lignes comme ambiguës plutôt que de deviner en silence.
function hasSeparateDebitCreditHeaders(headers: string[]): boolean {
  const kinds = new Set(headers.filter(h => /d[ée]bit|cr[ée]dit/i.test(h)).map(h => /d[ée]bit/i.test(h) ? 'debit' : 'credit'));
  return kinds.size >= 2;
}

// Découpe une ligne de texte extraite en cellules : la tabulation (préservée par
// pdf-parse entre les fragments de texte issus d'un même tableau visuel) est le
// séparateur le plus fiable ; à défaut, on retombe sur des runs de 2+ espaces
// (mise en page en colonnes alignées sans tabulation).
function splitTextRowCells(line: string): string[] {
  const bySeparator = line.includes('\t') ? line.split('\t') : line.split(/\s{2,}/);
  return bySeparator.map(c => c.trim()).filter(c => c !== '');
}

// Alias/sous-chaînes reconnus pour la colonne libellé — partagés entre la
// recherche en lecture (getLibelle) et le repérage en écriture ci-dessous
// (findLibelleKey, qui doit modifier la même colonne pour y recoller la
// suite d'un libellé étalé sur plusieurs lignes).
const LIBELLE_ALIASES = ['libelle', 'libellé', 'description', 'motif', 'intitule', 'intitulé'];
const LIBELLE_SUBSTRINGS = ['nature', 'libell', 'intitul', 'descript'];

// Retrouve la clé de colonne portant le libellé dans une ligne déjà zippée
// sur ses en-têtes réels (ex. "Nature de l'opération"), pour pouvoir y
// concaténer la suite d'une description répartie sur plusieurs lignes.
function findLibelleKey(row: Record<string, unknown>): string | null {
  const keys = Object.keys(row);
  const exact = keys.find(k => LIBELLE_ALIASES.includes(k.toLowerCase()));
  if (exact) return exact;
  return keys.find(k => LIBELLE_SUBSTRINGS.some(s => k.toLowerCase().includes(s))) ?? null;
}

// Une ligne de texte extraite du PDF est-elle la suite (sans date ni montant
// propre) du libellé de l'opération précédente, plutôt qu'un paragraphe sans
// rapport (mentions légales, publicité, RIB...) ? Les relevés impriment les
// compléments d'un libellé (ville/enseigne d'un retrait carte, "DE:"/"MOTIF:"
// d'un virement, référence d'un prélèvement) tout en majuscules, comme le
// reste du tableau d'opérations — contrairement au texte explicatif alentour,
// systématiquement en minuscules/casse mixte. On s'appuie sur ce contraste
// plutôt que sur la position/mise en page, indisponible en extraction texte.
function isContinuationText(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/[a-zà-ÿ]/.test(t)) return false;
  return /[A-ZÀ-Ÿ0-9]/.test(t);
}

// Repli texte : la ligne d'en-tête peut n'apparaître que sur la première page
// (les pages suivantes poursuivent le même tableau sans la répéter) — on la
// mémorise dès qu'elle est trouvée et on la réutilise pour toutes les pages
// suivantes, tout en ignorant les répétitions éventuelles.
function extractFromText(pages: { text: string }[]): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  let sharedHeaders: string[] | null = null;
  let debitCreditAmbigu = false;
  for (const page of pages) {
    const rawLines = page.text.split(/\r?\n/);
    const lines = rawLines.map(splitTextRowCells);
    const headerIdx = lines.findIndex(looksLikeHeaderRow);
    if (headerIdx >= 0 && !sharedHeaders) {
      sharedHeaders = lines[headerIdx]!;
      // Une cellule vide disparaît du texte extrait au lieu de laisser un trou : si la
      // ligne a moins de cellules que d'en-têtes, une colonne (potentiellement Débit
      // ou Crédit) a été perdue — voir hasSeparateDebitCreditHeaders ci-dessus.
      debitCreditAmbigu = hasSeparateDebitCreditHeaders(sharedHeaders);
    }

    // Ligne courante rattachée (et sa colonne libellé), pour recoller les
    // lignes de suite rencontrées juste après — voir isContinuationText.
    let lastRow: Record<string, unknown> | null = null;
    let lastLibelleKey: string | null = null;

    lines.forEach((cells, i) => {
      if (i === headerIdx) { lastRow = null; lastLibelleKey = null; return; }

      if (cells.length >= 2 && cells.some(isDateCell)) {
        let row: Record<string, unknown>;
        let libelleKey: string | null;
        if (!sharedHeaders) {
          row = mapPositionalRow(cells);
          libelleKey = 'libelle';
        } else {
          row = zipHeaderRow(sharedHeaders, cells);
          if (debitCreditAmbigu && cells.length < sharedHeaders.length) row['_ambigu'] = true;
          libelleKey = findLibelleKey(row);
        }
        rows.push(row);
        lastRow = row;
        lastLibelleKey = libelleKey;
        return;
      }

      const rawLine = (rawLines[i] ?? '').trim().replace(/\s+/g, ' ');
      if (lastRow && lastLibelleKey && isContinuationText(rawLine)) {
        const current = String(lastRow[lastLibelleKey] ?? '').trim();
        lastRow[lastLibelleKey] = current ? `${current} ${rawLine}` : rawLine;
        return;
      }

      // Ni une opération, ni la suite d'une opération : on referme le bloc en
      // cours pour ne pas accrocher par erreur un texte sans rapport à une
      // prochaine ligne qui ressemblerait, elle, à une suite de libellé.
      lastRow = null;
      lastLibelleKey = null;
    });
  }
  return rows;
}

function extractFromTable(pages: { tables: string[][][] }[]): Record<string, unknown>[] {
  // getTable() couvre déjà toutes les pages du PDF : on les fusionne ici pour
  // traiter le relevé comme un tout, quel que soit son nombre de pages.
  const allRows: string[][] = pages.flatMap(p => p.tables.flatMap(t => t));
  if (allRows.length > 1 && looksLikeHeaderRow(allRows[0]!)) {
    const headers = allRows[0]!.map(h => h.trim());
    // Une page suivante peut répéter la ligne d'en-tête (mise en page qui la
    // réimprime sur chaque page) : on l'exclut partout, pas seulement en tête.
    return allRows.slice(1).filter(cells => !looksLikeHeaderRow(cells)).map(cells => zipHeaderRow(headers, cells));
  }
  if (allRows.length > 1) {
    return allRows.map(mapPositionalRow);
  }
  return [];
}

// Extrait les lignes d'un relevé au format PDF, sur l'ensemble des pages du
// fichier (un relevé PDF fait fréquemment plusieurs pages internes, en plus du
// cas où plusieurs fichiers PDF distincts forment les pages d'un même relevé —
// voir l'upload multi-fichiers dans releve.routes.ts).
//
// Priorité au texte brut (getText) plutôt qu'à la détection de tableau
// (getTable) : testé sur un vrai relevé (Société Générale) contenant, en plus
// du tableau d'opérations, de petits encarts sans rapport (RIB, programme de
// fidélité...) que getTable() détecte aussi comme des "tableaux" et fusionne
// avec le vrai tableau — au point de masquer entièrement les transactions.
// Le texte, lui, conserve fidèlement les tabulations entre colonnes quand le
// PDF a une mise en page tabulaire propre, ce qui est le cas le plus courant.
// getTable() n'est utilisé qu'en dernier recours, si le texte n'a produit
// aucune ligne exploitable (relevé scanné/image, ou mise en page atypique).
async function parsePdfFile(filePath: string): Promise<Record<string, unknown>[]> {
  const parser = new PDFParse({ data: fs.readFileSync(filePath) });
  try {
    const textResult = await parser.getText();
    const textRows = extractFromText(textResult.pages);
    if (textRows.length > 0) return textRows;

    const tableResult = await parser.getTable();
    return extractFromTable(tableResult.pages);
  } finally {
    await parser.destroy();
  }
}

// Lit un fichier .xlsx (read-excel-file), .csv (parseur maison) ou .pdf (pdf-parse)
// et le normalise en tableau d'objets {en-tête: valeur}, comme le faisait
// XLSX.utils.sheet_to_json.
export async function parseSourceFile(filePath: string): Promise<Record<string, unknown>[]> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') {
    return parseCsv(fs.readFileSync(filePath, 'utf8'));
  }
  if (ext === '.pdf') {
    return parsePdfFile(filePath);
  }
  const rows = await readSheet(filePath); // première feuille par défaut
  if (rows.length === 0) return [];
  const headers = rows[0]!.map(h => String(h ?? '').trim());
  return rows.slice(1).map(row => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
    return obj;
  });
}

// Recherche insensible à la casse d'une colonne parmi plusieurs alias possibles.
export function getCol(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    const found = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
    if (found !== undefined) return row[found];
  }
  return '';
}

// Colonne libellé/description : plusieurs intitulés réels sont utilisés selon
// les banques ("Libellé", "Description", mais aussi "Nature de l'opération").
export function getLibelle(row: Record<string, unknown>): string {
  const key = findLibelleKey(row);
  return key ? String(row[key]) : 'Sans libellé';
}

// read-excel-file convertit nativement les cellules-date Excel en objets Date,
// mais une date saisie comme texte JJ/MM/AAAA (ou JJ/MM/AA — les relevés
// bancaires, notamment plus anciens, utilisent fréquemment l'année sur deux
// chiffres) reste une chaîne. Le constructeur Date() natif interprète
// "14/07/2026" en MM/DD/YYYY (donc invalide : mois 14), d'où un parseur
// JJ/MM/AA(AA) explicite plutôt que de se fier au format US ambigu.
export function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  const s = String(v || '').trim();
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/);
  if (m) {
    let year = Number(m[3]);
    if (m[3]!.length === 2) year += year < 50 ? 2000 : 1900;
    return new Date(year, Number(m[2]) - 1, Number(m[1]));
  }
  return new Date(s);
}

function toNumber(v: unknown): number {
  return parseFloat(String(v ?? '0').replace(/\s/g, '').replace(',', '.'));
}

export interface ParsedMontant {
  montant: number;
  type: 'DEBIT' | 'CREDIT';
}

// Un relevé bancaire peut exporter soit une seule colonne "Montant" signée
// (négatif = débit), soit deux colonnes séparées "Débit"/"Crédit" (format le
// plus courant sur les relevés papier/PDF). On gère les deux formats.
//
// Le repli texte PDF associe les cellules aux en-têtes par position (voir
// zipHeaderRow) : un fragment de texte sans rapport (numéro de référence,
// de pièce...) peut atterrir dans la colonne Débit/Crédit si l'extraction
// l'a isolé par une tabulation au milieu du libellé. On exige donc que la
// cellule ait la forme d'un montant (séparateur décimal + 2 chiffres) avant
// de l'accepter — sinon on la traite comme absente plutôt que comme un
// montant aberrant (ex. un numéro de référence à 10 chiffres pris pour un
// débit de plusieurs milliards).
export function parseMontantColumns(row: Record<string, unknown>): ParsedMontant {
  const debitRaw = getCol(row, 'debit', 'débit');
  const creditRaw = getCol(row, 'credit', 'crédit');
  if (debitRaw !== '' || creditRaw !== '') {
    const debit = isAmountCell(String(debitRaw)) ? toNumber(debitRaw) : NaN;
    const credit = isAmountCell(String(creditRaw)) ? toNumber(creditRaw) : NaN;
    if (!isNaN(debit) && debit > 0) return { montant: debit, type: 'DEBIT' };
    if (!isNaN(credit) && credit > 0) return { montant: credit, type: 'CREDIT' };
  }
  const montantRaw = toNumber(getCol(row, 'montant', 'amount', 'debit_credit'));
  return { montant: Math.abs(montantRaw), type: montantRaw < 0 ? 'DEBIT' : 'CREDIT' };
}

// Une ligne issue du repli texte PDF est incertaine quand une colonne Débit/Crédit
// s'est perdue dans l'extraction (voir hasSeparateDebitCreditHeaders) : le sens de
// l'opération est déterminé par défaut (crédit) mais ne peut pas être garanti sans
// les coordonnées réelles du PDF — la ligne reste importable mais signalée, à charge
// pour l'utilisateur de vérifier sur l'aperçu avant de valider (ou de corriger ensuite).
export function isRowAmbiguous(row: Record<string, unknown>): boolean {
  return row['_ambigu'] === true;
}

export interface PreviewLigne {
  date_operation: string | null;
  libelle: string;
  date_valeur: string | null;
  debit: number | null;
  credit: number | null;
  valide: boolean;
  incertain: boolean;
}

// Transforme une ligne brute (quel que soit le nom de ses colonnes) dans le
// format d'aperçu attendu par l'utilisateur : Date / Libellé / Valeur / Débit / Crédit.
export function toPreviewLigne(row: Record<string, unknown>): PreviewLigne {
  const { montant, type } = parseMontantColumns(row);
  const dateOp = toDate(getCol(row, 'date', 'date_operation', 'date opération', 'date_value'));
  const dateValeurRaw = getCol(row, 'date valeur', 'date_valeur', 'valeur');
  const incertain = isRowAmbiguous(row);
  const libelleBrut = getLibelle(row);
  const libelle = incertain ? `${libelleBrut} (sens débit/crédit incertain — à vérifier)` : libelleBrut;
  const valide = !isNaN(montant) && montant > 0 && !isNaN(dateOp.getTime());
  return {
    date_operation: !isNaN(dateOp.getTime()) ? dateOp.toISOString().slice(0, 10) : null,
    libelle,
    incertain,
    date_valeur: dateValeurRaw ? (() => { const d = toDate(dateValeurRaw); return !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null; })() : null,
    debit: type === 'DEBIT' ? montant : null,
    credit: type === 'CREDIT' ? montant : null,
    valide,
  };
}
