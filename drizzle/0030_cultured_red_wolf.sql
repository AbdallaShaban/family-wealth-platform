CREATE TABLE `investment_lots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`accountId` int NOT NULL,
	`instrumentId` int NOT NULL,
	`acquisitionEventId` int NOT NULL,
	`acquiredAt` bigint NOT NULL,
	`originalQuantity` decimal(24,8) NOT NULL,
	`remainingQuantity` decimal(24,8) NOT NULL,
	`unitCost` decimal(24,8) NOT NULL,
	`totalCost` decimal(24,8) NOT NULL,
	`costCurrency` varchar(3) NOT NULL,
	`feeAmount` decimal(24,8) NOT NULL DEFAULT '0',
	`taxAmount` decimal(24,8) NOT NULL DEFAULT '0',
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `investment_lots_id` PRIMARY KEY(`id`),
	CONSTRAINT `lots_acquisition_event_unique` UNIQUE(`acquisitionEventId`)
);
--> statement-breakpoint
CREATE TABLE `lot_matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`sellEventId` int NOT NULL,
	`lotId` int NOT NULL,
	`quantity` decimal(24,8) NOT NULL,
	`costBasis` decimal(24,8) NOT NULL,
	`grossProceeds` decimal(24,8) NOT NULL,
	`allocatedFee` decimal(24,8) NOT NULL DEFAULT '0',
	`allocatedTax` decimal(24,8) NOT NULL DEFAULT '0',
	`realizedPnl` decimal(24,8) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`matchedAt` bigint NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `lot_matches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `investment_lots` ADD CONSTRAINT `investment_lots_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `investment_lots` ADD CONSTRAINT `investment_lots_accountId_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `investment_lots` ADD CONSTRAINT `investment_lots_instrumentId_instruments_id_fk` FOREIGN KEY (`instrumentId`) REFERENCES `instruments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `investment_lots` ADD CONSTRAINT `investment_lots_acquisitionEventId_financial_events_id_fk` FOREIGN KEY (`acquisitionEventId`) REFERENCES `financial_events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lot_matches` ADD CONSTRAINT `lot_matches_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lot_matches` ADD CONSTRAINT `lot_matches_sellEventId_financial_events_id_fk` FOREIGN KEY (`sellEventId`) REFERENCES `financial_events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lot_matches` ADD CONSTRAINT `lot_matches_lotId_investment_lots_id_fk` FOREIGN KEY (`lotId`) REFERENCES `investment_lots`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `lots_workspace_instrument_idx` ON `investment_lots` (`workspaceId`,`instrumentId`);--> statement-breakpoint
CREATE INDEX `lots_fifo_idx` ON `investment_lots` (`workspaceId`,`accountId`,`instrumentId`,`acquiredAt`,`id`);--> statement-breakpoint
CREATE INDEX `lot_matches_workspace_sell_idx` ON `lot_matches` (`workspaceId`,`sellEventId`);--> statement-breakpoint
CREATE INDEX `lot_matches_lot_idx` ON `lot_matches` (`workspaceId`,`lotId`);