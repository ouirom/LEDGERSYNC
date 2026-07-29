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
  pays?: Pays | null;
  succursales?: Succursale[];
}

export interface Pays {
  id: number;
  code_iso: string;
  nom: string;
  devise: string;
}

export interface Utilisateur {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: string;
  etat: string;
  derniere_connexion?: string | null;
  entreprise_id?: number | null;
  service_id?: number | null;
  entreprise?: { id: number; nom: string; code?: string } | null;
  service?: { id: number; nom: string; direction?: { id: number; nom: string; succursale?: { id: number; nom: string } } } | null;
}

export const ROLES_UTILISATEUR = ['SUPER_ADMIN', 'ADMIN_TENANT', 'DAF', 'MANAGER', 'SUPERVISEUR', 'USER', 'AUDITEUR'] as const;
export type RoleUtilisateur = typeof ROLES_UTILISATEUR[number];

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

export interface ReleveBancaire {
  id: number;
  compte_bancaire_id: number;
  reference?: string | null;
  date_debut?: string | null;
  date_fin?: string | null;
  nb_pages: number;
  etat: string;
  created_at: string;
  compte_bancaire?: { id: number; intitule: string; banque?: { nom: string } };
  _count?: { lignes: number };
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

export interface ImportPreview {
  nb_pages: number;
  total_lignes: number;
  lignes_invalides: number;
  lignes_incertaines: number;
  pages: { nom: string; nb_lignes: number }[];
  apercu: PreviewLigne[];
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

export interface LogConnexion {
  id: number;
  utilisateur_id: number;
  succes: boolean;
  motif_echec: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  utilisateur: { id: number; nom: string; prenom: string; email: string };
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
