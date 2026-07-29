# Fichiers d'exemple — Import de relevés bancaires

Ces fichiers servent à tester manuellement la page **Import Excel**
(`/reconciliation/excel-import`) sans avoir à en construire à la main.
Régénérables avec :

```bash
cd server
npx tsx scripts/generate_sample_releves.ts
```

| Fichier | Format | Ce qu'il teste |
|---|---|---|
| `01_montant_signe.csv` | CSV | Colonne `Montant` unique signée (négatif = débit). 5 lignes, aucune ambiguïté. |
| `02_debit_credit.csv` | CSV | Colonnes `Debit`/`Credit` séparées. 5 lignes, aucune ambiguïté (le CSV préserve les cellules vides). |
| `03_montant_signe.xlsx` | Excel | Équivalent Excel du cas colonne signée. 4 lignes. |
| `04a_pdf_page1.pdf` + `04b_pdf_page2.pdf` | PDF (2 fichiers) | Les deux **pages d'un même relevé** à uploader **ensemble** en une seule fois (glisser-déposer les deux fichiers) — vérifie le regroupement multi-fichiers sous un seul `ReleveBancaire`. Colonnes Débit/Crédit séparées : ces lignes remontent volontairement avec le badge **« sens débit/crédit incertain »**, car le texte extrait d'un PDF ne conserve pas les cellules vides — comportement attendu, à vérifier dans l'aperçu avant de valider. |
| `05_pdf_multipage_interne.pdf` | PDF (1 fichier, 2 pages internes) | Un **seul** fichier PDF dont l'en-tête n'apparaît qu'en page 1 — vérifie que les lignes de la page 2 sont correctement rattachées à cet en-tête. Colonne Montant signée : aucune ambiguïté, 4 lignes attendues. |

## Comment tester

1. Se connecter (ex. `admin@ledgersync.demo` / `Admin@2026!`).
2. Aller sur **Import Excel**, choisir un compte bancaire.
3. Déposer un ou plusieurs des fichiers ci-dessus (pour `04a`/`04b`, déposer les deux ensemble).
4. Cliquer **Prévisualiser** et vérifier l'aperçu (colonnes Date/Libellé/Valeur/Débit/Crédit, avertissements éventuels).
5. Cliquer **Valider l'import** et suivre la progression.
6. Vérifier le relevé importé dans le panneau « Relevés de ce compte » en bas de page.
