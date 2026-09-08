CREATE TABLE `insurance_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`profileId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`policyType` enum('health','life','property','motor','other') NOT NULL,
	`insurer` varchar(160),
	`policyNumber` varchar(160),
	`coverageAmount` decimal(20,6),
	`currency` varchar(3) NOT NULL,
	`premiumAmount` decimal(20,6),
	`premiumCadence` enum('monthly','quarterly','yearly','other'),
	`cashFlowCategoryId` int,
	`startsAt` bigint,
	`endsAt` bigint,
	`beneficiaries` text,
	`claimsNote` text,
	`status` enum('active','expired','archived') NOT NULL DEFAULT 'active',
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `insurance_policies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `special_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`profileId` int NOT NULL,
	`assetAccountId` int NOT NULL,
	`assetType` enum('real_estate','gold','commodity','other') NOT NULL,
	`name` varchar(200) NOT NULL,
	`quantity` decimal(24,8),
	`unit` varchar(48),
	`details` text,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `special_assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `special_assets_account_unique` UNIQUE(`assetAccountId`)
);
--> statement-breakpoint
ALTER TABLE `insurance_policies` ADD CONSTRAINT `insurance_policies_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `insurance_policies` ADD CONSTRAINT `insurance_policies_profileId_financial_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `financial_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `insurance_policies` ADD CONSTRAINT `insurance_policies_cashFlowCategoryId_cash_flow_categories_id_fk` FOREIGN KEY (`cashFlowCategoryId`) REFERENCES `cash_flow_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `insurance_policies` ADD CONSTRAINT `insurance_policies_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `special_assets` ADD CONSTRAINT `special_assets_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `special_assets` ADD CONSTRAINT `special_assets_profileId_financial_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `financial_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `special_assets` ADD CONSTRAINT `special_assets_assetAccountId_accounts_id_fk` FOREIGN KEY (`assetAccountId`) REFERENCES `accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `special_assets` ADD CONSTRAINT `special_assets_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `insurance_workspace_status_idx` ON `insurance_policies` (`workspaceId`,`status`);--> statement-breakpoint
CREATE INDEX `special_assets_workspace_status_idx` ON `special_assets` (`workspaceId`,`status`);