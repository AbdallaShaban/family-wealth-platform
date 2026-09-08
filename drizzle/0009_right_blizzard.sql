CREATE TABLE `budgets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`categoryId` int NOT NULL,
	`periodKey` varchar(7) NOT NULL,
	`plannedAmountBase` decimal(20,6) NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `budgets_id` PRIMARY KEY(`id`),
	CONSTRAINT `budgets_workspace_category_period_unique` UNIQUE(`workspaceId`,`categoryId`,`periodKey`)
);
--> statement-breakpoint
CREATE TABLE `cash_flow_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`direction` enum('income','expense') NOT NULL,
	`color` varchar(16),
	`isArchived` enum('yes','no') NOT NULL DEFAULT 'no',
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `cash_flow_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_workspace_direction_name_unique` UNIQUE(`workspaceId`,`direction`,`name`)
);
--> statement-breakpoint
CREATE TABLE `recurring_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`profileId` int NOT NULL,
	`accountId` int NOT NULL,
	`categoryId` int,
	`eventType` enum('income','expense','deposit','withdrawal') NOT NULL,
	`amount` decimal(20,6) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`cadence` enum('weekly','monthly','quarterly','yearly') NOT NULL,
	`nextRunAt` bigint NOT NULL,
	`endsAt` bigint,
	`status` enum('active','paused','completed') NOT NULL DEFAULT 'active',
	`memo` text,
	`scheduleCronTaskUid` varchar(65),
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `recurring_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `financial_events` ADD `categoryId` int;--> statement-breakpoint
ALTER TABLE `financial_events` ADD `source` enum('manual','imported','api','system_generated') DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `budgets` ADD CONSTRAINT `budgets_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budgets` ADD CONSTRAINT `budgets_categoryId_cash_flow_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `cash_flow_categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budgets` ADD CONSTRAINT `budgets_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_flow_categories` ADD CONSTRAINT `cash_flow_categories_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recurring_rules` ADD CONSTRAINT `recurring_rules_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recurring_rules` ADD CONSTRAINT `recurring_rules_profileId_financial_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `financial_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recurring_rules` ADD CONSTRAINT `recurring_rules_accountId_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recurring_rules` ADD CONSTRAINT `recurring_rules_categoryId_cash_flow_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `cash_flow_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recurring_rules` ADD CONSTRAINT `recurring_rules_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `budgets_workspace_period_idx` ON `budgets` (`workspaceId`,`periodKey`);--> statement-breakpoint
CREATE INDEX `recurring_workspace_next_run_idx` ON `recurring_rules` (`workspaceId`,`status`,`nextRunAt`);--> statement-breakpoint
CREATE INDEX `recurring_schedule_task_uid_idx` ON `recurring_rules` (`scheduleCronTaskUid`);--> statement-breakpoint
ALTER TABLE `financial_events` ADD CONSTRAINT `financial_events_categoryId_cash_flow_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `cash_flow_categories`(`id`) ON DELETE no action ON UPDATE no action;