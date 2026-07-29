// Types légers reflétant les réponses API réellement consommées par l'UI
// (pas une réplique complète des modèles Prisma — juste les champs utilisés).

export interface Theme {
  id: number;
  nom: string;
  couleur_primaire: string;
  couleur_secondaire: string;
  couleur_accent: string;
  mode_sombre: boolean;
}

export interface Service {
  id: number;
  nom: string;
  code: string;
  etat: string;
}

export interface Direction {
  id: number;
  nom: string;
  code: string;
  etat: string;
  services?: Service[];
}

export interface SousSuccursale {
  id: number;
  nom: string;
  code: string;
  etat: string;
}

export interface Succursale {
  id: number;
  nom: string;
  code: string;
  etat: string;
  sous_succursales?: SousSuccursale[];
  directions?: Direction[];
}

export interface Entreprise {
  id: number;
  nom: string;
  code?: string;
  theme?: Theme | null;
  succursales?: Succursale[];
}

export interface Utilisateur {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: string;
  etat: string;
  derniere_connexion?: string | null;
  entreprise?: { id: number; nom: string; code?: string } | null;
}

export interface Banque {
  id: number;
  nom: string;
  code_swift?: string | null;
}

export interface Compte {
  id: number;
  intitule: string;
  entreprise_id: number;
  devise?: string;
  banque?: { id: number; nom: string } | null;
}

export interface BanqueTemplate {
  id: number;
  banque_id: number;
  nom: string;
  mapping_colonnes: Record<string, string>;
  ligne_entete: number;
  format_date: string;
  etat: string;
  banque?: { nom: string };
}

export interface Periode {
  id: number;
  entreprise_id: number;
  mois: number;
  annee: number;
  statut: string;
}

export interface JobTraitement {
  id: number;
  nom_fichier: string | null;
  type_job: string;
  progression: number;
  lignes_traitees: number;
  total_lignes: number;
  statut: string;
  created_at: string;
}

export interface ImputationCategorie {
  id: number;
  code: string;
  libelle: string;
  type: 'DEBIT' | 'CREDIT';
  compte_imputation?: string | null;
}

export interface AuditLog {
  id: number;
  entite: string;
  action: string;
  entite_id: number | null;
  utilisateur_id: number | null;
  ip_address: string | null;
  motif: string | null;
  created_at: string;
  avant?: unknown;
  apres?: unknown;
}

export interface AutoMatchSuggestion {
  ecriture_id: number;
  releve_id: number;
  score: number;
  montant_ecart: number;
}

export interface DashboardSummary {
  periode: { mois: number; annee: number };
  ecritures: { total: number; lettrees: number; tauxLettrage: number };
  jobs: { enCours: number };
  rapprochements: { ouverts: number; valides: number };
  audit: { logsThisMois: number };
}
