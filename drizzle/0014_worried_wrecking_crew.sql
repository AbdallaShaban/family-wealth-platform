CREATE TABLE `fee_tax_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`profileId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`chargeType` enum('fee','tax') NOT NULL,
	`appliesTo` enum('buy','sell','both') NOT NULL,
	`calculationMethod` enum('flat','percentage') NOT NULL,
	`value` decimal(20,8) NOT NULL,
	`currency` varchar(3),
	`jurisdictionNote` text,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `fee_tax_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `fee_tax_rules` ADD CONSTRAINT `fee_tax_rules_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fee_tax_rules` ADD CONSTRAINT `fee_tax_rules_profileId_financial_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `financial_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fee_tax_rules` ADD CONSTRAINT `fee_tax_rules_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `fee_tax_rules_workspace_profile_status_idx` ON `fee_tax_rules` (`workspaceId`,`profileId`,`status`);