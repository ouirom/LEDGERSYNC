-- AlterTable
ALTER TABLE `banques` ADD COLUMN `entreprise_id` INTEGER NULL,
    ADD COLUMN `succursale_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `comptes_bancaires` ADD COLUMN `succursale_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `ecritures_comptables` ADD COLUMN `succursale_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `utilisateurs` ADD COLUMN `direction_id` INTEGER NULL,
    ADD COLUMN `succursale_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `utilisateurs` ADD CONSTRAINT `utilisateurs_succursale_id_fkey` FOREIGN KEY (`succursale_id`) REFERENCES `succursales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `utilisateurs` ADD CONSTRAINT `utilisateurs_direction_id_fkey` FOREIGN KEY (`direction_id`) REFERENCES `directions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `banques` ADD CONSTRAINT `banques_entreprise_id_fkey` FOREIGN KEY (`entreprise_id`) REFERENCES `entreprises`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `banques` ADD CONSTRAINT `banques_succursale_id_fkey` FOREIGN KEY (`succursale_id`) REFERENCES `succursales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comptes_bancaires` ADD CONSTRAINT `comptes_bancaires_succursale_id_fkey` FOREIGN KEY (`succursale_id`) REFERENCES `succursales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ecritures_comptables` ADD CONSTRAINT `ecritures_comptables_succursale_id_fkey` FOREIGN KEY (`succursale_id`) REFERENCES `succursales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
