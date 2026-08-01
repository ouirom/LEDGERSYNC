-- AlterTable
ALTER TABLE `rapprochements` ADD COLUMN `date_reouverture` DATETIME(3) NULL,
    ADD COLUMN `motif_reouverture` TEXT NULL,
    ADD COLUMN `reouvert_par` INTEGER NULL;
