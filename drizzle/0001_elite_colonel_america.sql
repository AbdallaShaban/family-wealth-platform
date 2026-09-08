ALTER TABLE `accounts` MODIFY COLUMN `ownerProfileId` int;--> statement-breakpoint
ALTER TABLE `accounts` MODIFY COLUMN `accountType` enum('cash','bank','brokerage','wallet','credit','loan','asset','equity','income','expense','clearing') NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `isSystemAccount` enum('yes','no') DEFAULT 'no' NOT NULL;