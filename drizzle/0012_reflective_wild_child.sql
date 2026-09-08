CREATE TABLE `allocation_targets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`profileId` int NOT NULL,
	`assetClass` enum('cash','equity','fixed_income','alternatives','other') NOT NULL,
	`targetPercent` decimal(8,4) NOT NULL,
	`driftThresholdPercent` decimal(8,4) NOT NULL DEFAULT '5',
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `allocation_targets_id` PRIMARY KEY(`id`),
	CONSTRAINT `allocation_workspace_profile_asset_class_unique` UNIQUE(`workspaceId`,`profileId`,`assetClass`)
);
--> statement-breakpoint
CREATE TABLE `risk_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`profileId` int NOT NULL,
	`riskLevel` enum('conservative','moderate','growth','aggressive') NOT NULL,
	`questionnaireScore` int,
	`rationale` text,
	`completedAt` bigint NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `risk_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `risk_profile_workspace_profile_unique` UNIQUE(`workspaceId`,`profileId`)
);
--> statement-breakpoint
ALTER TABLE `allocation_targets` ADD CONSTRAINT `allocation_targets_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `allocation_targets` ADD CONSTRAINT `allocation_targets_profileId_financial_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `financial_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `allocation_targets` ADD CONSTRAINT `allocation_targets_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `risk_profiles` ADD CONSTRAINT `risk_profiles_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `risk_profiles` ADD CONSTRAINT `risk_profiles_profileId_financial_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `financial_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `risk_profiles` ADD CONSTRAINT `risk_profiles_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;