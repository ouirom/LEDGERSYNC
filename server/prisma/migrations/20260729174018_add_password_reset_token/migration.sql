-- AlterTable
ALTER TABLE `utilisateurs` ADD COLUMN `reset_token_expires` DATETIME(3) NULL,
    ADD COLUMN `reset_token_hash` VARCHAR(255) NULL;
