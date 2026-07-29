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

// Extrait les lignes d'un relevé au format PDF. Tente d'abord la détection de
// tableau (grille visible dans le PDF, le cas le plus fiable) ; si aucun tableau
// n'est détecté (relevé "à plat", sans bordures vectorielles — le cas le plus
// courant en pratique), replie sur le texte brut extrait page par page, en
// utilisant la ligne d'en-tête si elle est repérable (mêmes noms de colonnes
// que pour un CSV/Excel), sinon une reconstruction positionnelle best-effort.
async function parsePdfFile(filePath: string): Promise<Record<string, unknown>[]> {
  const parser = new PDFParse({ data: fs.readFileSync(filePath) });
  try {
    const tableResult = await parser.getTable();
    const allRows: string[][] = tableResult.pages.flatMap(p => p.tables.flatMap(t => t));

    if (allRows.length > 1 && looksLikeHeaderRow(allRows[0]!)) {
      const headers = allRows[0]!.map(h => h.trim());
      return allRows.slice(1).map(cells => zipHeaderRow(headers, cells));
    }
    if (allRows.length > 1) {
      return allRows.map(mapPositionalRow);
    }

    // Repli texte : une page peut contenir sa propre ligne d'en-tête (relevés
    // multi-pages qui la répètent) — on la recherche indépendamment par page.
    const textResult = await parser.getText();
    const rows: Record<string, unknown>[] = [];
    for (const page of textResult.pages) {
      const lines = page.text.split(/\r?\n/).map(splitTextRowCells).filter(cells => cells.length >= 2);
      const headerIdx = lines.findIndex(looksLikeHeaderRow);
      const headers = headerIdx >= 0 ? lines[headerIdx] : null;
      // Une cellule vide disparaît du texte extrait au lieu de laisser un trou : si la
      // ligne a moins de cellules que d'en-têtes, une colonne (potentiellement Débit
      // ou Crédit) a été perdue — voir hasSeparateDebitCreditHeaders ci-dessus.
      const debitCreditAmbigu = headers ? hasSeparateDebitCreditHeaders(headers) : false;

      lines.forEach((cells, i) => {
        if (i === headerIdx || !cells.some(isDateCell)) return;
        if (!headers) { rows.push(mapPositionalRow(cells)); return; }
        const row = zipHeaderRow(headers, cells);
        if (debitCreditAmbigu && cells.length < headers.length) row['_ambigu'] = true;
        rows.push(row);
      });
    }
    return rows;
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

// read-excel-file convertit nativement les cellules-date Excel en objets Date,
// mais une date saisie comme texte JJ/MM/AAAA reste une chaîne. Le constructeur
// Date() natif interprète "14/07/2026" en MM/DD/YYYY (donc invalide : mois 14),
// d'où un parseur JJ/MM/AAAA explicite plutôt que de se fier au format US ambigu.
export function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  const s = String(v || '').trim();
  const m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
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
export function parseMontantColumns(row: Record<string, unknown>): ParsedMontant {
  const debitRaw = getCol(row, 'debit', 'débit');
  const creditRaw = getCol(row, 'credit', 'crédit');
  if (debitRaw !== '' || creditRaw !== '') {
    const debit = toNumber(debitRaw);
    const credit = toNumber(creditRaw);
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
  const dateValeurRaw = getCol(row, 'date valeur', 'date_valeur');
  const incertain = isRowAmbiguous(row);
  const libelleBrut = String(getCol(row, 'libelle', 'libellé', 'description', 'motif') || 'Sans libellé');
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
