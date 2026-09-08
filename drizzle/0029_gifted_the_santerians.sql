CREATE TABLE `official_valuation_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`valuationAsOf` bigint NOT NULL,
	`capturedAt` bigint NOT NULL,
	`baseCurrency` varchar(3) NOT NULL,
	`status` enum('official','review_required','unavailable') NOT NULL,
	`quality` enum('current','delayed','stale','manual','unavailable') NOT NULL,
	`netWorthBase` decimal(24,8),
	`liquidBalanceBase` decimal(24,8),
	`investmentValueBase` decimal(24,8),
	`liabilityBalanceBase` decimal(24,8),
	`unrealizedPnlBase` decimal(24,8),
	`componentSnapshotIds` json NOT NULL,
	`sourceSummary` json NOT NULL,
	`warnings` json NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `official_valuation_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `official_valuation_snapshots` ADD CONSTRAINT `official_valuation_snapshots_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `official_valuation_snapshots` ADD CONSTRAINT `official_valuation_snapshots_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `official_valuation_workspace_captured_idx` ON `official_valuation_snapshots` (`workspaceId`,`capturedAt`);--> statement-breakpoint
CREATE INDEX `official_valuation_workspace_asof_idx` ON `official_valuation_snapshots` (`workspaceId`,`valuationAsOf`);