CREATE TABLE `bank_statement_imports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`accountId` int NOT NULL,
	`originalFilename` varchar(255) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`contentHash` varchar(64) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`columnMapping` json NOT NULL,
	`status` enum('review','ready','posting','posted','failed') NOT NULL DEFAULT 'review',
	`rowCount` int NOT NULL DEFAULT 0,
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `bank_statement_imports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bank_statement_rows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`importId` int NOT NULL,
	`sourceRowNumber` int NOT NULL,
	`rawData` json NOT NULL,
	`occurredAt` bigint,
	`description` text,
	`amount` decimal(20,6),
	`currency` varchar(3) NOT NULL,
	`externalRef` varchar(160),
	`classification` enum('income','expense','transfer','ignore','unclassified') NOT NULL DEFAULT 'unclassified',
	`categoryId` int,
	`matchStatus` enum('new','exact_duplicate','possible_duplicate','invalid','posted','excluded') NOT NULL DEFAULT 'new',
	`matchedEventId` int,
	`postedEventId` int,
	`reviewNote` text,
	`idempotencyKey` varchar(160) NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `bank_statement_rows_id` PRIMARY KEY(`id`),
	CONSTRAINT `bank_row_import_number_unique` UNIQUE(`importId`,`sourceRowNumber`),
	CONSTRAINT `bank_row_workspace_idempotency_unique` UNIQUE(`workspaceId`,`idempotencyKey`)
);
--> statement-breakpoint
ALTER TABLE `bank_statement_imports` ADD CONSTRAINT `bank_statement_imports_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_statement_imports` ADD CONSTRAINT `bank_statement_imports_accountId_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_statement_imports` ADD CONSTRAINT `bank_statement_imports_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_statement_rows` ADD CONSTRAINT `bank_statement_rows_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_statement_rows` ADD CONSTRAINT `bank_statement_rows_importId_bank_statement_imports_id_fk` FOREIGN KEY (`importId`) REFERENCES `bank_statement_imports`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_statement_rows` ADD CONSTRAINT `bank_statement_rows_categoryId_cash_flow_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `cash_flow_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_statement_rows` ADD CONSTRAINT `bank_statement_rows_matchedEventId_financial_events_id_fk` FOREIGN KEY (`matchedEventId`) REFERENCES `financial_events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_statement_rows` ADD CONSTRAINT `bank_statement_rows_postedEventId_financial_events_id_fk` FOREIGN KEY (`postedEventId`) REFERENCES `financial_events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `bank_import_workspace_status_idx` ON `bank_statement_imports` (`workspaceId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `bank_import_workspace_hash_idx` ON `bank_statement_imports` (`workspaceId`,`contentHash`);--> statement-breakpoint
CREATE INDEX `bank_row_workspace_status_idx` ON `bank_statement_rows` (`workspaceId`,`matchStatus`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `bank_row_import_status_idx` ON `bank_statement_rows` (`importId`,`matchStatus`);