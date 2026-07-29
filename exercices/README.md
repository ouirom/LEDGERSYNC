# Fichiers d'exercice — LedgerSync

Générés le 26 juillet 2026

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

- **Lettrage parfait** : Utiliser `exercice_lettrage_parfait_juillet_2026.xlsx`
  → Les 10 lignes relevé correspondent exactement aux 10 écritures
  
- **Stress test** : Utiliser `releve_banque_annee_2026_2000lignes.xlsx`
  → Teste le chunking BullMQ et la progression WebSocket
  
- **Micro-écarts** : Utiliser `exercice_avec_ecarts_micro.xlsx`
  → Teste l'apurement automatique sous le seuil de tolérance (0.05 XOF)
