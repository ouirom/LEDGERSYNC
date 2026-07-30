-- CreateTable
CREATE TABLE `parametres_application` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `categorie` VARCHAR(50) NOT NULL,
    `cle` VARCHAR(100) NOT NULL,
    `valeur` TEXT NULL,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'ACTIF',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    UNIQUE INDEX `parametres_application_categorie_cle_key`(`categorie`, `cle`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
