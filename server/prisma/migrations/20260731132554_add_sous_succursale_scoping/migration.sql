-- AlterTable
ALTER TABLE `banques` ADD COLUMN `sous_succursale_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `comptes_bancaires` ADD COLUMN `sous_succursale_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `ecritures_comptables` ADD COLUMN `sous_succursale_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `utilisateurs` ADD COLUMN `sous_succursale_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `utilisateurs` ADD CONSTRAINT `utilisateurs_sous_succursale_id_fkey` FOREIGN KEY (`sous_succursale_id`) REFERENCES `sous_succursales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `banques` ADD CONSTRAINT `banques_sous_succursale_id_fkey` FOREIGN KEY (`sous_succursale_id`) REFERENCES `sous_succursales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comptes_bancaires` ADD CONSTRAINT `comptes_bancaires_sous_succursale_id_fkey` FOREIGN KEY (`sous_succursale_id`) REFERENCES `sous_succursales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ecritures_comptables` ADD CONSTRAINT `ecritures_comptables_sous_succursale_id_fkey` FOREIGN KEY (`sous_succursale_id`) REFERENCES `sous_succursales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
