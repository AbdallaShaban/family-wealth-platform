CREATE TABLE `retirement_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`profileId` int NOT NULL,
	`currentAge` int NOT NULL,
	`retirementAge` int NOT NULL,
	`currentRetirementAssets` decimal(20,6) NOT NULL,
	`monthlyContribution` decimal(20,6) NOT NULL,
	`annualSpending` decimal(20,6) NOT NULL,
	`safeWithdrawalRate` decimal(12,6) NOT NULL,
	`assumedAnnualReturn` decimal(12,6) NOT NULL,
	`assumedAnnualInflation` decimal(12,6) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `retirement_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `retirement_workspace_profile_unique` UNIQUE(`workspaceId`,`profileId`)
);
--> statement-breakpoint
ALTER TABLE `financial_goals` ADD `priority` int DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_goals` ADD `fundingSource` enum('cash_flow','savings','investments','mixed','other') DEFAULT 'cash_flow' NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_goals` ADD `monthlyContribution` decimal(20,6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_goals` ADD `assumedAnnualReturn` decimal(12,6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_goals` ADD `assumedAnnualInflation` decimal(12,6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `retirement_plans` ADD CONSTRAINT `retirement_plans_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `retirement_plans` ADD CONSTRAINT `retirement_plans_profileId_financial_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `financial_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `retirement_plans` ADD CONSTRAINT `retirement_plans_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;