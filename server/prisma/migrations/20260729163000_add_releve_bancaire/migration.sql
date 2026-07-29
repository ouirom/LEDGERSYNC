-- AlterTable
ALTER TABLE `releve_bancaire_lignes` ADD COLUMN `releve_bancaire_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `releves_bancaires` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `compte_bancaire_id` INTEGER NOT NULL,
    `job_id` INTEGER NULL,
    `reference` VARCHAR(100) NULL,
    `date_debut` DATE NULL,
    `date_fin` DATE NULL,
    `nb_pages` INTEGER NOT NULL DEFAULT 1,
    `etat` ENUM('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE', 'BROUILLON', 'VALIDE', 'ANNULE') NOT NULL DEFAULT 'BROUILLON',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `releve_bancaire_lignes_releve_bancaire_id_idx` ON `releve_bancaire_lignes`(`releve_bancaire_id`);

-- AddForeignKey
ALTER TABLE `releves_bancaires` ADD CONSTRAINT `releves_bancaires_compte_bancaire_id_fkey` FOREIGN KEY (`compte_bancaire_id`) REFERENCES `comptes_bancaires`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `releves_bancaires` ADD CONSTRAINT `releves_bancaires_job_id_fkey` FOREIGN KEY (`job_id`) REFERENCES `jobs_traitements`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `releve_bancaire_lignes` ADD CONSTRAINT `releve_bancaire_lignes_releve_bancaire_id_fkey` FOREIGN KEY (`releve_bancaire_id`) REFERENCES `releves_bancaires`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
