CREATE TABLE `corporate_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`instrumentId` int NOT NULL,
	`financialEventId` int NOT NULL,
	`actionType` enum('stock_split') NOT NULL,
	`ratio` decimal(24,8) NOT NULL,
	`effectiveAt` bigint NOT NULL,
	`source` enum('manual','imported','api') NOT NULL DEFAULT 'manual',
	`memo` text,
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `corporate_actions_id` PRIMARY KEY(`id`),
	CONSTRAINT `corporate_actions_event_unique` UNIQUE(`financialEventId`)
);
--> statement-breakpoint
CREATE TABLE `lot_transfers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`transferEventId` int NOT NULL,
	`sourceLotId` int NOT NULL,
	`destinationLotId` int NOT NULL,
	`quantity` decimal(24,8) NOT NULL,
	`costBasis` decimal(24,8) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `lot_transfers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `investment_lots` ADD INDEX `lots_acquisition_event_idx` (`acquisitionEventId`);--> statement-breakpoint
ALTER TABLE `investment_lots` DROP INDEX `lots_acquisition_event_unique`;--> statement-breakpoint
ALTER TABLE `investment_lots` ADD `sourceLotId` int;--> statement-breakpoint
ALTER TABLE `corporate_actions` ADD CONSTRAINT `corporate_actions_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `corporate_actions` ADD CONSTRAINT `corporate_actions_instrumentId_instruments_id_fk` FOREIGN KEY (`instrumentId`) REFERENCES `instruments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `corporate_actions` ADD CONSTRAINT `corporate_actions_financialEventId_financial_events_id_fk` FOREIGN KEY (`financialEventId`) REFERENCES `financial_events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `corporate_actions` ADD CONSTRAINT `corporate_actions_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lot_transfers` ADD CONSTRAINT `lot_transfers_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lot_transfers` ADD CONSTRAINT `lot_transfers_transferEventId_financial_events_id_fk` FOREIGN KEY (`transferEventId`) REFERENCES `financial_events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lot_transfers` ADD CONSTRAINT `lot_transfers_sourceLotId_investment_lots_id_fk` FOREIGN KEY (`sourceLotId`) REFERENCES `investment_lots`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lot_transfers` ADD CONSTRAINT `lot_transfers_destinationLotId_investment_lots_id_fk` FOREIGN KEY (`destinationLotId`) REFERENCES `investment_lots`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `corporate_actions_workspace_instrument_idx` ON `corporate_actions` (`workspaceId`,`instrumentId`,`effectiveAt`);--> statement-breakpoint
CREATE INDEX `lot_transfers_event_idx` ON `lot_transfers` (`workspaceId`,`transferEventId`);--> statement-breakpoint
CREATE INDEX `lot_transfers_source_idx` ON `lot_transfers` (`workspaceId`,`sourceLotId`);--> statement-breakpoint
CREATE INDEX `lot_transfers_destination_idx` ON `lot_transfers` (`workspaceId`,`destinationLotId`);--> statement-breakpoint
CREATE INDEX `lots_source_lot_idx` ON `investment_lots` (`workspaceId`,`sourceLotId`);