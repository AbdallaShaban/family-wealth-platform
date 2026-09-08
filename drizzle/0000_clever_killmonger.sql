CREATE TABLE `accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`ownerProfileId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`accountType` enum('cash','bank','brokerage','wallet','credit','loan','asset') NOT NULL,
	`currency` varchar(3) NOT NULL,
	`institution` varchar(160),
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`actorUserId` int NOT NULL,
	`action` varchar(120) NOT NULL,
	`targetType` varchar(100) NOT NULL,
	`targetId` varchar(100) NOT NULL,
	`beforeState` json,
	`afterState` json,
	`requestId` varchar(120) NOT NULL,
	`occurredAt` bigint NOT NULL,
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financial_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`profileId` int NOT NULL,
	`primaryAccountId` int,
	`instrumentId` int,
	`eventType` enum('opening_balance','deposit','withdrawal','transfer','buy','sell','dividend','income','expense','fee','tax','adjustment','reversal') NOT NULL,
	`status` enum('draft','validated','posted','reversed','void') NOT NULL DEFAULT 'draft',
	`occurredAt` bigint NOT NULL,
	`currency` varchar(3) NOT NULL,
	`grossAmount` decimal(20,6) NOT NULL,
	`feeAmount` decimal(20,6) NOT NULL DEFAULT '0',
	`taxAmount` decimal(20,6) NOT NULL DEFAULT '0',
	`quantity` decimal(24,8),
	`unitPrice` decimal(20,8),
	`externalRef` varchar(160),
	`idempotencyKey` varchar(160) NOT NULL,
	`memo` text,
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `financial_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `events_workspace_idempotency_unique` UNIQUE(`workspaceId`,`idempotencyKey`),
	CONSTRAINT `events_workspace_external_ref_unique` UNIQUE(`workspaceId`,`externalRef`)
);
--> statement-breakpoint
CREATE TABLE `financial_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`userId` int NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`relationship` enum('self','spouse','child','parent','advisor','other') NOT NULL DEFAULT 'self',
	`isFinancialOwner` enum('yes','no') NOT NULL DEFAULT 'yes',
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `financial_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `profiles_workspace_user_unique` UNIQUE(`workspaceId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `instruments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`symbol` varchar(48),
	`name` varchar(200) NOT NULL,
	`assetType` enum('equity','fund','bond','gold','real_estate','cash_equivalent','other') NOT NULL,
	`currency` varchar(3) NOT NULL,
	`isin` varchar(32),
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `instruments_id` PRIMARY KEY(`id`),
	CONSTRAINT `instruments_workspace_symbol_unique` UNIQUE(`workspaceId`,`symbol`)
);
--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`eventId` int NOT NULL,
	`status` enum('posted','reversed') NOT NULL DEFAULT 'posted',
	`postedAt` bigint NOT NULL,
	`reversalOfEntryId` int,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `journal_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `journal_entries_event_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
CREATE TABLE `journal_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`entryId` int NOT NULL,
	`accountId` int NOT NULL,
	`direction` enum('debit','credit') NOT NULL,
	`amount` decimal(20,6) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`fxRateToBase` decimal(20,10) NOT NULL DEFAULT '1',
	`baseAmount` decimal(20,6) NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `journal_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','advisor','editor','viewer') NOT NULL DEFAULT 'viewer',
	`status` enum('active','invited','suspended') NOT NULL DEFAULT 'active',
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `memberships_workspace_user_unique` UNIQUE(`workspaceId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `positions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`accountId` int NOT NULL,
	`instrumentId` int NOT NULL,
	`quantity` decimal(24,8) NOT NULL DEFAULT '0',
	`averageCost` decimal(20,8) NOT NULL DEFAULT '0',
	`costCurrency` varchar(3) NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `positions_id` PRIMARY KEY(`id`),
	CONSTRAINT `positions_account_instrument_unique` UNIQUE(`accountId`,`instrumentId`)
);
--> statement-breakpoint
CREATE TABLE `price_quotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`instrumentId` int NOT NULL,
	`price` decimal(20,8) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`source` varchar(120) NOT NULL,
	`quoteStatus` enum('live','delayed','last_known','manual','unavailable') NOT NULL,
	`asOf` bigint NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `price_quotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`baseCurrency` varchar(3) NOT NULL DEFAULT 'EGP',
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `workspaces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_ownerProfileId_financial_profiles_id_fk` FOREIGN KEY (`ownerProfileId`) REFERENCES `financial_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_events` ADD CONSTRAINT `financial_events_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_events` ADD CONSTRAINT `financial_events_profileId_financial_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `financial_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_events` ADD CONSTRAINT `financial_events_primaryAccountId_accounts_id_fk` FOREIGN KEY (`primaryAccountId`) REFERENCES `accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_events` ADD CONSTRAINT `financial_events_instrumentId_instruments_id_fk` FOREIGN KEY (`instrumentId`) REFERENCES `instruments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_events` ADD CONSTRAINT `financial_events_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_profiles` ADD CONSTRAINT `financial_profiles_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_profiles` ADD CONSTRAINT `financial_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `instruments` ADD CONSTRAINT `instruments_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_eventId_financial_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `financial_events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journal_lines` ADD CONSTRAINT `journal_lines_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journal_lines` ADD CONSTRAINT `journal_lines_entryId_journal_entries_id_fk` FOREIGN KEY (`entryId`) REFERENCES `journal_entries`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journal_lines` ADD CONSTRAINT `journal_lines_accountId_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `positions` ADD CONSTRAINT `positions_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `positions` ADD CONSTRAINT `positions_accountId_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `positions` ADD CONSTRAINT `positions_instrumentId_instruments_id_fk` FOREIGN KEY (`instrumentId`) REFERENCES `instruments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `price_quotes` ADD CONSTRAINT `price_quotes_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `price_quotes` ADD CONSTRAINT `price_quotes_instrumentId_instruments_id_fk` FOREIGN KEY (`instrumentId`) REFERENCES `instruments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workspaces` ADD CONSTRAINT `workspaces_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `accounts_workspace_idx` ON `accounts` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `accounts_owner_idx` ON `accounts` (`ownerProfileId`);--> statement-breakpoint
CREATE INDEX `audit_workspace_occurred_idx` ON `audit_events` (`workspaceId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `audit_target_idx` ON `audit_events` (`targetType`,`targetId`);--> statement-breakpoint
CREATE INDEX `events_workspace_occurred_idx` ON `financial_events` (`workspaceId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `events_account_idx` ON `financial_events` (`primaryAccountId`);--> statement-breakpoint
CREATE INDEX `profiles_workspace_idx` ON `financial_profiles` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `instruments_workspace_idx` ON `instruments` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `journal_entries_workspace_idx` ON `journal_entries` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `journal_lines_workspace_account_idx` ON `journal_lines` (`workspaceId`,`accountId`);--> statement-breakpoint
CREATE INDEX `journal_lines_entry_idx` ON `journal_lines` (`entryId`);--> statement-breakpoint
CREATE INDEX `memberships_user_idx` ON `memberships` (`userId`);--> statement-breakpoint
CREATE INDEX `positions_workspace_idx` ON `positions` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `quotes_instrument_asof_idx` ON `price_quotes` (`instrumentId`,`asOf`);--> statement-breakpoint
CREATE INDEX `workspaces_creator_idx` ON `workspaces` (`createdByUserId`);
