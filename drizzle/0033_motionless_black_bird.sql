CREATE TABLE `special_asset_valuations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`profileId` int NOT NULL,
	`assetId` int NOT NULL,
	`financialEventId` int,
	`valuationMethod` enum('market_quote','manual','appraisal') NOT NULL,
	`value` decimal(20,6) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`marketSymbol` varchar(48),
	`source` varchar(255) NOT NULL,
	`quoteValue` decimal(20,8),
	`quoteCurrency` varchar(3),
	`asOf` bigint NOT NULL,
	`quality` enum('fresh','delayed','manual','stale','review_required') NOT NULL,
	`note` text,
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `special_asset_valuations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `insurance_policies` ADD `renewalAt` bigint;--> statement-breakpoint
ALTER TABLE `insurance_policies` ADD `premiumDueDay` int;--> statement-breakpoint
ALTER TABLE `insurance_policies` ADD `deductibleAmount` decimal(20,6);--> statement-breakpoint
ALTER TABLE `insurance_policies` ADD `deductibleCurrency` varchar(3);--> statement-breakpoint
ALTER TABLE `insurance_policies` ADD `providerContact` varchar(255);--> statement-breakpoint
ALTER TABLE `insurance_policies` ADD `policyTerms` text;--> statement-breakpoint
ALTER TABLE `special_assets` ADD `ownershipType` enum('sole','joint','usufruct','other') DEFAULT 'sole' NOT NULL;--> statement-breakpoint
ALTER TABLE `special_assets` ADD `ownershipShare` decimal(8,5) DEFAULT '100' NOT NULL;--> statement-breakpoint
ALTER TABLE `special_assets` ADD `acquisitionDate` bigint;--> statement-breakpoint
ALTER TABLE `special_assets` ADD `acquisitionCost` decimal(20,6);--> statement-breakpoint
ALTER TABLE `special_assets` ADD `acquisitionCurrency` varchar(3);--> statement-breakpoint
ALTER TABLE `special_assets` ADD `location` varchar(255);--> statement-breakpoint
ALTER TABLE `special_assets` ADD `marketSymbol` varchar(48);--> statement-breakpoint
ALTER TABLE `special_assets` ADD `purity` decimal(10,6);--> statement-breakpoint
ALTER TABLE `special_assets` ADD `valuationMethod` enum('ledger_balance','market_quote','manual','appraisal') DEFAULT 'ledger_balance' NOT NULL;--> statement-breakpoint
ALTER TABLE `special_assets` ADD `valuationSource` varchar(255);--> statement-breakpoint
ALTER TABLE `special_assets` ADD `valuationAsOf` bigint;--> statement-breakpoint
ALTER TABLE `special_assets` ADD `valuationStatus` enum('unvalued','current','stale','review_required') DEFAULT 'unvalued' NOT NULL;--> statement-breakpoint
ALTER TABLE `special_assets` ADD `valuationNote` text;--> statement-breakpoint
ALTER TABLE `special_asset_valuations` ADD CONSTRAINT `special_asset_valuations_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `special_asset_valuations` ADD CONSTRAINT `special_asset_valuations_profileId_financial_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `financial_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `special_asset_valuations` ADD CONSTRAINT `special_asset_valuations_assetId_special_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `special_assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `special_asset_valuations` ADD CONSTRAINT `special_asset_valuations_financialEventId_financial_events_id_fk` FOREIGN KEY (`financialEventId`) REFERENCES `financial_events`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `special_asset_valuations` ADD CONSTRAINT `special_asset_valuations_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `special_asset_valuations_asset_asof_idx` ON `special_asset_valuations` (`assetId`,`asOf`);--> statement-breakpoint
CREATE INDEX `special_asset_valuations_workspace_idx` ON `special_asset_valuations` (`workspaceId`,`asOf`);--> statement-breakpoint
CREATE INDEX `special_assets_valuation_status_idx` ON `special_assets` (`workspaceId`,`valuationStatus`,`valuationAsOf`);