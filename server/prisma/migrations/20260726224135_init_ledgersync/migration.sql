-- CreateTable
CREATE TABLE `themes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nom` VARCHAR(100) NOT NULL,
    `couleur_primaire` VARCHAR(7) NOT NULL,
    `couleur_secondaire` VARCHAR(7) NOT NULL,
    `couleur_accent` VARCHAR(7) NOT NULL,
    `logo_url` VARCHAR(500) NULL,
    `mode_sombre` BOOLEAN NOT NULL DEFAULT false,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'BROUILLON',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenants` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(20) NOT NULL,
    `nom` VARCHAR(200) NOT NULL,
    `domaine` VARCHAR(100) NULL,
    `theme_id` INTEGER NULL,
    `plan` VARCHAR(50) NOT NULL DEFAULT 'STANDARD',
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'BROUILLON',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    UNIQUE INDEX `tenants_code_key`(`code`),
    UNIQUE INDEX `tenants_domaine_key`(`domaine`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pays` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code_iso` VARCHAR(3) NOT NULL,
    `nom` VARCHAR(100) NOT NULL,
    `devise` VARCHAR(10) NOT NULL,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'ACTIF',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    UNIQUE INDEX `pays_code_iso_key`(`code_iso`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `entreprises` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `pays_id` INTEGER NULL,
    `theme_id` INTEGER NULL,
    `code` VARCHAR(20) NOT NULL,
    `nom` VARCHAR(200) NOT NULL,
    `siret` VARCHAR(50) NULL,
    `adresse` TEXT NULL,
    `logo_url` VARCHAR(500) NULL,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'BROUILLON',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    UNIQUE INDEX `entreprises_tenant_id_code_key`(`tenant_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `succursales` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `entreprise_id` INTEGER NOT NULL,
    `nom` VARCHAR(200) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'ACTIF',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sous_succursales` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `succursale_id` INTEGER NOT NULL,
    `nom` VARCHAR(200) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'ACTIF',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `directions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `succursale_id` INTEGER NOT NULL,
    `nom` VARCHAR(200) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'ACTIF',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `services` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `direction_id` INTEGER NOT NULL,
    `nom` VARCHAR(200) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'ACTIF',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `utilisateurs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `entreprise_id` INTEGER NULL,
    `service_id` INTEGER NULL,
    `email` VARCHAR(255) NOT NULL,
    `nom` VARCHAR(100) NOT NULL,
    `prenom` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'ADMIN_TENANT', 'DAF', 'MANAGER', 'SUPERVISEUR', 'USER', 'AUDITEUR') NOT NULL DEFAULT 'USER',
    `refresh_token` TEXT NULL,
    `derniere_connexion` DATETIME(3) NULL,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'ACTIF',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    UNIQUE INDEX `utilisateurs_tenant_id_email_key`(`tenant_id`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `logs_connexion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `utilisateur_id` INTEGER NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `succes` BOOLEAN NOT NULL,
    `motif_echec` VARCHAR(255) NULL,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'ACTIF',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `logs_traitement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `utilisateur_id` INTEGER NULL,
    `entite` VARCHAR(100) NOT NULL,
    `entite_id` INTEGER NULL,
    `action` VARCHAR(100) NOT NULL,
    `avant` JSON NULL,
    `apres` JSON NULL,
    `motif` TEXT NULL,
    `ip_address` VARCHAR(45) NULL,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'ACTIF',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jobs_traitements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `utilisateur_id` INTEGER NULL,
    `bull_job_id` VARCHAR(100) NULL,
    `type_job` VARCHAR(100) NOT NULL,
    `nom_fichier` VARCHAR(255) NULL,
    `total_lignes` INTEGER NOT NULL DEFAULT 0,
    `lignes_traitees` INTEGER NOT NULL DEFAULT 0,
    `index_derniere_ligne` INTEGER NOT NULL DEFAULT 0,
    `progression` DOUBLE NOT NULL DEFAULT 0,
    `statut` ENUM('EN_ATTENTE', 'EN_COURS', 'COMPLETE', 'ECHOUE', 'ANNULE', 'SUSPENDU') NOT NULL DEFAULT 'EN_ATTENTE',
    `message_erreur` TEXT NULL,
    `resultat` JSON NULL,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'BROUILLON',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `periodes_comptables` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `entreprise_id` INTEGER NOT NULL,
    `mois` INTEGER NOT NULL,
    `annee` INTEGER NOT NULL,
    `statut` ENUM('OUVERT', 'VERROUILLE', 'CLOS') NOT NULL DEFAULT 'OUVERT',
    `date_cloture` DATETIME(3) NULL,
    `clos_par` INTEGER NULL,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'ACTIF',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    UNIQUE INDEX `periodes_comptables_entreprise_id_mois_annee_key`(`entreprise_id`, `mois`, `annee`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `banques` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `code_swift` VARCHAR(20) NULL,
    `nom` VARCHAR(200) NOT NULL,
    `pays_code` VARCHAR(3) NULL,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'ACTIF',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `banque_releve_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `banque_id` INTEGER NOT NULL,
    `nom` VARCHAR(100) NOT NULL,
    `mapping_colonnes` JSON NOT NULL,
    `ligne_entete` INTEGER NOT NULL DEFAULT 1,
    `separateur` VARCHAR(5) NULL,
    `format_date` VARCHAR(30) NOT NULL,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'ACTIF',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comptes_bancaires` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `entreprise_id` INTEGER NOT NULL,
    `banque_id` INTEGER NOT NULL,
    `numero_compte` VARCHAR(50) NOT NULL,
    `iban` VARCHAR(34) NULL,
    `intitule` VARCHAR(200) NOT NULL,
    `devise` VARCHAR(10) NOT NULL DEFAULT 'XOF',
    `solde_initial` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'ACTIF',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `imputations_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `libelle` VARCHAR(200) NOT NULL,
    `type` ENUM('DEBIT', 'CREDIT') NOT NULL,
    `compte_imputation` VARCHAR(20) NULL,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'ACTIF',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ecritures_comptables` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `entreprise_id` INTEGER NOT NULL,
    `compte_bancaire_id` INTEGER NULL,
    `reference` VARCHAR(100) NOT NULL,
    `libelle` TEXT NOT NULL,
    `montant` DECIMAL(18, 2) NOT NULL,
    `type` ENUM('DEBIT', 'CREDIT') NOT NULL,
    `date_ecriture` DATE NOT NULL,
    `date_valeur` DATE NULL,
    `piece_ref` VARCHAR(100) NULL,
    `lettrage_ref` VARCHAR(50) NULL,
    `lettree` BOOLEAN NOT NULL DEFAULT false,
    `periode_mois` INTEGER NOT NULL,
    `periode_annee` INTEGER NOT NULL,
    `extourne_de` INTEGER NULL,
    `motif_annulation` TEXT NULL,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'BROUILLON',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    INDEX `ecritures_comptables_entreprise_id_periode_mois_periode_anne_idx`(`entreprise_id`, `periode_mois`, `periode_annee`),
    INDEX `ecritures_comptables_lettrage_ref_idx`(`lettrage_ref`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `releve_bancaire_lignes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `compte_bancaire_id` INTEGER NOT NULL,
    `job_id` INTEGER NULL,
    `reference` VARCHAR(100) NULL,
    `libelle` TEXT NOT NULL,
    `montant` DECIMAL(18, 2) NOT NULL,
    `type` ENUM('DEBIT', 'CREDIT') NOT NULL,
    `date_operation` DATE NOT NULL,
    `date_valeur` DATE NULL,
    `lettrage_ref` VARCHAR(50) NULL,
    `lettree` BOOLEAN NOT NULL DEFAULT false,
    `num_ligne` INTEGER NOT NULL,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'BROUILLON',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    INDEX `releve_bancaire_lignes_compte_bancaire_id_lettree_idx`(`compte_bancaire_id`, `lettree`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rapprochements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `entreprise_id` INTEGER NOT NULL,
    `compte_bancaire_id` INTEGER NOT NULL,
    `periode_mois` INTEGER NOT NULL,
    `periode_annee` INTEGER NOT NULL,
    `statut` ENUM('BROUILLON', 'EN_COURS', 'SOUMIS', 'VALIDE_N1', 'VALIDE_N2', 'VALIDE_FINAL', 'REJETE', 'CLOS') NOT NULL DEFAULT 'BROUILLON',
    `montant_ecart` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `soumis_par` INTEGER NULL,
    `valide_n1_par` INTEGER NULL,
    `valide_n2_par` INTEGER NULL,
    `valide_final_par` INTEGER NULL,
    `date_validation_final` DATETIME(3) NULL,
    `motif_rejet` TEXT NULL,
    `pv_url` VARCHAR(500) NULL,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'BROUILLON',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    UNIQUE INDEX `rapprochements_entreprise_id_compte_bancaire_id_periode_mois_key`(`entreprise_id`, `compte_bancaire_id`, `periode_mois`, `periode_annee`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `justificatifs_rapprochement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rapprochement_id` INTEGER NOT NULL,
    `nom_fichier` VARCHAR(255) NOT NULL,
    `url_fichier` VARCHAR(500) NOT NULL,
    `type_fichier` ENUM('EXCEL', 'PDF', 'IMAGE', 'CSV') NOT NULL,
    `taille_octets` INTEGER NULL,
    `description` TEXT NULL,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'ACTIF',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fichiers_sources` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `job_id` INTEGER NULL,
    `tenant_id` INTEGER NOT NULL,
    `nom_original` VARCHAR(255) NOT NULL,
    `nom_stockage` VARCHAR(255) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `type_fichier` ENUM('EXCEL', 'PDF', 'IMAGE', 'CSV') NOT NULL,
    `taille_octets` INTEGER NULL,
    `nb_lignes` INTEGER NULL,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'BROUILLON',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tenants` ADD CONSTRAINT `tenants_theme_id_fkey` FOREIGN KEY (`theme_id`) REFERENCES `themes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entreprises` ADD CONSTRAINT `entreprises_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entreprises` ADD CONSTRAINT `entreprises_pays_id_fkey` FOREIGN KEY (`pays_id`) REFERENCES `pays`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entreprises` ADD CONSTRAINT `entreprises_theme_id_fkey` FOREIGN KEY (`theme_id`) REFERENCES `themes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `succursales` ADD CONSTRAINT `succursales_entreprise_id_fkey` FOREIGN KEY (`entreprise_id`) REFERENCES `entreprises`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sous_succursales` ADD CONSTRAINT `sous_succursales_succursale_id_fkey` FOREIGN KEY (`succursale_id`) REFERENCES `succursales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `directions` ADD CONSTRAINT `directions_succursale_id_fkey` FOREIGN KEY (`succursale_id`) REFERENCES `succursales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `services` ADD CONSTRAINT `services_direction_id_fkey` FOREIGN KEY (`direction_id`) REFERENCES `directions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `utilisateurs` ADD CONSTRAINT `utilisateurs_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `utilisateurs` ADD CONSTRAINT `utilisateurs_entreprise_id_fkey` FOREIGN KEY (`entreprise_id`) REFERENCES `entreprises`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `utilisateurs` ADD CONSTRAINT `utilisateurs_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `logs_connexion` ADD CONSTRAINT `logs_connexion_utilisateur_id_fkey` FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs_traitements` ADD CONSTRAINT `jobs_traitements_utilisateur_id_fkey` FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `periodes_comptables` ADD CONSTRAINT `periodes_comptables_entreprise_id_fkey` FOREIGN KEY (`entreprise_id`) REFERENCES `entreprises`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `banque_releve_templates` ADD CONSTRAINT `banque_releve_templates_banque_id_fkey` FOREIGN KEY (`banque_id`) REFERENCES `banques`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comptes_bancaires` ADD CONSTRAINT `comptes_bancaires_entreprise_id_fkey` FOREIGN KEY (`entreprise_id`) REFERENCES `entreprises`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comptes_bancaires` ADD CONSTRAINT `comptes_bancaires_banque_id_fkey` FOREIGN KEY (`banque_id`) REFERENCES `banques`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ecritures_comptables` ADD CONSTRAINT `ecritures_comptables_entreprise_id_fkey` FOREIGN KEY (`entreprise_id`) REFERENCES `entreprises`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ecritures_comptables` ADD CONSTRAINT `ecritures_comptables_compte_bancaire_id_fkey` FOREIGN KEY (`compte_bancaire_id`) REFERENCES `comptes_bancaires`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `releve_bancaire_lignes` ADD CONSTRAINT `releve_bancaire_lignes_compte_bancaire_id_fkey` FOREIGN KEY (`compte_bancaire_id`) REFERENCES `comptes_bancaires`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rapprochements` ADD CONSTRAINT `rapprochements_entreprise_id_fkey` FOREIGN KEY (`entreprise_id`) REFERENCES `entreprises`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rapprochements` ADD CONSTRAINT `rapprochements_compte_bancaire_id_fkey` FOREIGN KEY (`compte_bancaire_id`) REFERENCES `comptes_bancaires`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `justificatifs_rapprochement` ADD CONSTRAINT `justificatifs_rapprochement_rapprochement_id_fkey` FOREIGN KEY (`rapprochement_id`) REFERENCES `rapprochements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fichiers_sources` ADD CONSTRAINT `fichiers_sources_job_id_fkey` FOREIGN KEY (`job_id`) REFERENCES `jobs_traitements`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
