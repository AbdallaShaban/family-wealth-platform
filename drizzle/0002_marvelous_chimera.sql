ALTER TABLE `financial_events` ADD `counterAccountId` int;--> statement-breakpoint
ALTER TABLE `financial_events` ADD CONSTRAINT `financial_events_counterAccountId_accounts_id_fk` FOREIGN KEY (`counterAccountId`) REFERENCES `accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `events_counter_account_idx` ON `financial_events` (`counterAccountId`);