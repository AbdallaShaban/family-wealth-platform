CREATE TABLE `research_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`profileId` int NOT NULL,
	`instrumentId` int,
	`title` varchar(180) NOT NULL,
	`thesis` text NOT NULL,
	`risks` text,
	`sourceUrl` varchar(2048),
	`status` enum('draft','active','archived') NOT NULL DEFAULT 'draft',
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `research_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `watchlist_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`profileId` int NOT NULL,
	`instrumentId` int NOT NULL,
	`note` text,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `watchlist_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `watchlist_workspace_profile_instrument_unique` UNIQUE(`workspaceId`,`profileId`,`instrumentId`)
);
--> statement-breakpoint
ALTER TABLE `research_notes` ADD CONSTRAINT `research_notes_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `research_notes` ADD CONSTRAINT `research_notes_profileId_financial_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `financial_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `research_notes` ADD CONSTRAINT `research_notes_instrumentId_instruments_id_fk` FOREIGN KEY (`instrumentId`) REFERENCES `instruments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `research_notes` ADD CONSTRAINT `research_notes_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `watchlist_items` ADD CONSTRAINT `watchlist_items_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `watchlist_items` ADD CONSTRAINT `watchlist_items_profileId_financial_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `financial_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `watchlist_items` ADD CONSTRAINT `watchlist_items_instrumentId_instruments_id_fk` FOREIGN KEY (`instrumentId`) REFERENCES `instruments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `watchlist_items` ADD CONSTRAINT `watchlist_items_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `research_workspace_status_idx` ON `research_notes` (`workspaceId`,`status`);--> statement-breakpoint
CREATE INDEX `watchlist_workspace_status_idx` ON `watchlist_items` (`workspaceId`,`status`);