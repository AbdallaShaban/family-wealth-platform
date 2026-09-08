CREATE TABLE `financial_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`profileId` int,
	`name` varchar(160) NOT NULL,
	`goalType` enum('emergency_fund','retirement','education','legacy','custom') NOT NULL,
	`metric` enum('net_worth','liquid_assets','investments') NOT NULL,
	`targetAmount` decimal(20,6) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`targetDate` bigint,
	`status` enum('active','paused','completed','archived') NOT NULL DEFAULT 'active',
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `financial_goals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `financial_goals` ADD CONSTRAINT `financial_goals_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_goals` ADD CONSTRAINT `financial_goals_profileId_financial_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `financial_profiles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `goals_workspace_status_idx` ON `financial_goals` (`workspaceId`,`status`);