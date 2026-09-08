CREATE TABLE `insurance_premium_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`profileId` int NOT NULL,
	`policyId` int NOT NULL,
	`financialEventId` int NOT NULL,
	`cashAccountId` int NOT NULL,
	`amount` decimal(20,6) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`occurredAt` bigint NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `insurance_premium_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `insurance_premium_event_unique` UNIQUE(`financialEventId`)
);
--> statement-breakpoint
ALTER TABLE `insurance_premium_payments` ADD CONSTRAINT `insurance_premium_payments_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `insurance_premium_payments` ADD CONSTRAINT `insurance_premium_payments_profileId_financial_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `financial_profiles`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `insurance_premium_payments` ADD CONSTRAINT `insurance_premium_payments_policyId_insurance_policies_id_fk` FOREIGN KEY (`policyId`) REFERENCES `insurance_policies`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `insurance_premium_payments` ADD CONSTRAINT `insurance_premium_payments_financialEventId_financial_events_id_fk` FOREIGN KEY (`financialEventId`) REFERENCES `financial_events`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `insurance_premium_payments` ADD CONSTRAINT `insurance_premium_payments_cashAccountId_accounts_id_fk` FOREIGN KEY (`cashAccountId`) REFERENCES `accounts`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `insurance_premium_payments` ADD CONSTRAINT `insurance_premium_payments_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `insurance_premium_policy_occurred_idx` ON `insurance_premium_payments` (`policyId`,`occurredAt`);
--> statement-breakpoint
CREATE INDEX `insurance_premium_workspace_profile_idx` ON `insurance_premium_payments` (`workspaceId`,`profileId`);
