CREATE TABLE `debt_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`debtId` int NOT NULL,
	`financialEventId` int NOT NULL,
	`cashAccountId` int NOT NULL,
	`principalAmount` decimal(20,6) NOT NULL,
	`interestAmount` decimal(20,6) NOT NULL DEFAULT '0',
	`feeAmount` decimal(20,6) NOT NULL DEFAULT '0',
	`currency` varchar(3) NOT NULL,
	`occurredAt` bigint NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `debt_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `debt_payments_event_unique` UNIQUE(`financialEventId`)
);
--> statement-breakpoint
CREATE TABLE `debts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`profileId` int NOT NULL,
	`liabilityAccountId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`lender` varchar(160),
	`debtType` enum('loan','credit_card','mortgage','personal','other') NOT NULL,
	`originalPrincipal` decimal(20,6) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`annualInterestRate` decimal(12,6) NOT NULL DEFAULT '0',
	`minimumPayment` decimal(20,6) NOT NULL,
	`paymentDay` int,
	`startDate` bigint NOT NULL,
	`maturityDate` bigint,
	`cashFlowCategoryId` int,
	`status` enum('active','paid','archived') NOT NULL DEFAULT 'active',
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `debts_id` PRIMARY KEY(`id`),
	CONSTRAINT `debts_liability_account_unique` UNIQUE(`liabilityAccountId`)
);
--> statement-breakpoint
CREATE TABLE `emergency_fund_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`profileId` int NOT NULL,
	`targetMonths` decimal(8,2) NOT NULL,
	`lookbackMonths` int NOT NULL DEFAULT 3,
	`targetDate` bigint,
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `emergency_fund_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `emergency_fund_workspace_profile_unique` UNIQUE(`workspaceId`,`profileId`)
);
--> statement-breakpoint
ALTER TABLE `financial_events` MODIFY COLUMN `eventType` enum('opening_balance','deposit','withdrawal','transfer','buy','sell','dividend','income','expense','fee','tax','adjustment','reversal','debt_origination','debt_payment') NOT NULL;--> statement-breakpoint
ALTER TABLE `cash_flow_categories` ADD `isEssential` enum('yes','no') DEFAULT 'no' NOT NULL;--> statement-breakpoint
ALTER TABLE `debt_payments` ADD CONSTRAINT `debt_payments_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `debt_payments` ADD CONSTRAINT `debt_payments_debtId_debts_id_fk` FOREIGN KEY (`debtId`) REFERENCES `debts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `debt_payments` ADD CONSTRAINT `debt_payments_financialEventId_financial_events_id_fk` FOREIGN KEY (`financialEventId`) REFERENCES `financial_events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `debt_payments` ADD CONSTRAINT `debt_payments_cashAccountId_accounts_id_fk` FOREIGN KEY (`cashAccountId`) REFERENCES `accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `debts` ADD CONSTRAINT `debts_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `debts` ADD CONSTRAINT `debts_profileId_financial_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `financial_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `debts` ADD CONSTRAINT `debts_liabilityAccountId_accounts_id_fk` FOREIGN KEY (`liabilityAccountId`) REFERENCES `accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `debts` ADD CONSTRAINT `debts_cashFlowCategoryId_cash_flow_categories_id_fk` FOREIGN KEY (`cashFlowCategoryId`) REFERENCES `cash_flow_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `debts` ADD CONSTRAINT `debts_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emergency_fund_plans` ADD CONSTRAINT `emergency_fund_plans_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emergency_fund_plans` ADD CONSTRAINT `emergency_fund_plans_profileId_financial_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `financial_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emergency_fund_plans` ADD CONSTRAINT `emergency_fund_plans_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `debt_payments_workspace_debt_idx` ON `debt_payments` (`workspaceId`,`debtId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `debts_workspace_status_idx` ON `debts` (`workspaceId`,`status`);