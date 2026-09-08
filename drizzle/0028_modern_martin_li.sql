CREATE TABLE `valuation_provenance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`sourceType` enum('market_provider','manual','derived') NOT NULL,
	`provider` varchar(120) NOT NULL,
	`source` varchar(160) NOT NULL,
	`rawSymbol` varchar(120),
	`normalizedSymbol` varchar(120),
	`fetchedAt` bigint,
	`asOf` bigint,
	`status` enum('live','delayed','last_known','manual','unavailable') NOT NULL,
	`responseHash` varchar(128),
	`metadata` json,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `valuation_provenance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `valuation_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`subjectType` enum('instrument','account','special_asset','net_worth') NOT NULL,
	`subjectId` int,
	`provenanceId` int NOT NULL,
	`quoteId` int,
	`fxRateId` int,
	`nativeValue` decimal(24,8) NOT NULL,
	`nativeCurrency` varchar(3) NOT NULL,
	`baseValue` decimal(24,8),
	`baseCurrency` varchar(3) NOT NULL,
	`quantity` decimal(24,8),
	`unit` varchar(48),
	`valuationMethod` enum('market_quote','fx_converted','manual','derived') NOT NULL,
	`quality` enum('current','delayed','stale','manual','unavailable') NOT NULL,
	`asOf` bigint NOT NULL,
	`capturedAt` bigint NOT NULL,
	`createdByUserId` int,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `valuation_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `valuation_provenance` ADD CONSTRAINT `valuation_provenance_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `valuation_snapshots` ADD CONSTRAINT `valuation_snapshots_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `valuation_snapshots` ADD CONSTRAINT `valuation_snapshots_provenanceId_valuation_provenance_id_fk` FOREIGN KEY (`provenanceId`) REFERENCES `valuation_provenance`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `valuation_snapshots` ADD CONSTRAINT `valuation_snapshots_quoteId_price_quotes_id_fk` FOREIGN KEY (`quoteId`) REFERENCES `price_quotes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `valuation_snapshots` ADD CONSTRAINT `valuation_snapshots_fxRateId_fx_rates_id_fk` FOREIGN KEY (`fxRateId`) REFERENCES `fx_rates`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `valuation_snapshots` ADD CONSTRAINT `valuation_snapshots_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `valuation_provenance_workspace_asof_idx` ON `valuation_provenance` (`workspaceId`,`asOf`);--> statement-breakpoint
CREATE INDEX `valuation_provenance_symbol_idx` ON `valuation_provenance` (`workspaceId`,`normalizedSymbol`);--> statement-breakpoint
CREATE INDEX `valuation_snapshots_workspace_subject_asof_idx` ON `valuation_snapshots` (`workspaceId`,`subjectType`,`subjectId`,`asOf`);--> statement-breakpoint
CREATE INDEX `valuation_snapshots_provenance_idx` ON `valuation_snapshots` (`provenanceId`);--> statement-breakpoint
CREATE INDEX `valuation_snapshots_quote_idx` ON `valuation_snapshots` (`quoteId`);