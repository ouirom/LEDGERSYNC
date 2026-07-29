import { readSheet } from 'read-excel-file/node';
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

// Lit un fichier .xlsx (read-excel-file) ou .csv (parseur maison) et le
// normalise en tableau d'objets {en-tête: valeur}, comme le faisait XLSX.utils.sheet_to_json.
export async function parseSourceFile(filePath: string): Promise<Record<string, unknown>[]> {
  if (path.extname(filePath).toLowerCase() === '.csv') {
    return parseCsv(fs.readFileSync(filePath, 'utf8'));
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

export interface PreviewLigne {
  date_operation: string | null;
  libelle: string;
  date_valeur: string | null;
  debit: number | null;
  credit: number | null;
  valide: boolean;
}

// Transforme une ligne brute (quel que soit le nom de ses colonnes) dans le
// format d'aperçu attendu par l'utilisateur : Date / Libellé / Valeur / Débit / Crédit.
export function toPreviewLigne(row: Record<string, unknown>): PreviewLigne {
  const { montant, type } = parseMontantColumns(row);
  const dateOp = toDate(getCol(row, 'date', 'date_operation', 'date opération', 'date_value'));
  const dateValeurRaw = getCol(row, 'date valeur', 'date_valeur');
  const libelle = String(getCol(row, 'libelle', 'libellé', 'description', 'motif') || 'Sans libellé');
  const valide = !isNaN(montant) && montant > 0 && !isNaN(dateOp.getTime());
  return {
    date_operation: !isNaN(dateOp.getTime()) ? dateOp.toISOString().slice(0, 10) : null,
    libelle,
    date_valeur: dateValeurRaw ? (() => { const d = toDate(dateValeurRaw); return !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null; })() : null,
    debit: type === 'DEBIT' ? montant : null,
    credit: type === 'CREDIT' ? montant : null,
    valide,
  };
}
