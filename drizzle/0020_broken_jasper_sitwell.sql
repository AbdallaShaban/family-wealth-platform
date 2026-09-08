CREATE TABLE `insurance_claims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`profileId` int NOT NULL,
	`policyId` int NOT NULL,
	`referenceNumber` varchar(160),
	`claimedAmount` decimal(20,6) NOT NULL,
	`receivedAmount` decimal(20,6),
	`currency` varchar(3) NOT NULL,
	`submittedAt` bigint NOT NULL,
	`expectedAt` bigint,
	`receivedEventId` int,
	`status` enum('submitted','approved','paid','rejected','closed') NOT NULL DEFAULT 'submitted',
	`note` text,
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `insurance_claims_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `personal_ious` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`profileId` int NOT NULL,
	`direction` enum('receivable','payable') NOT NULL,
	`counterpartyName` varchar(200) NOT NULL,
	`description` text,
	`amount` decimal(20,6) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`dueAt` bigint,
	`settlementEventId` int,
	`status` enum('active','settled','archived') NOT NULL DEFAULT 'active',
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `personal_ious_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vault_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`profileId` int NOT NULL,
	`encryptedStorageKey` text NOT NULL,
	`encryptedOriginalName` text NOT NULL,
	`mimeType` varchar(160) NOT NULL,
	`byteSize` int NOT NULL,
	`sha256` varchar(64) NOT NULL,
	`linkedEntityType` varchar(80) NOT NULL,
	`linkedEntityId` varchar(100) NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `vault_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `zakat_assessments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`profileId` int NOT NULL,
	`haulStartedAt` bigint NOT NULL,
	`assessedAt` bigint NOT NULL,
	`goldNisabGrams` decimal(12,4) NOT NULL,
	`goldPricePerGramBase` decimal(20,6) NOT NULL,
	`eligibleBase` decimal(20,6) NOT NULL,
	`nisabBase` decimal(20,6) NOT NULL,
	`zakatDueBase` decimal(20,6) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`methodology` json NOT NULL,
	`paymentEventId` int,
	`status` enum('calculated','paid','archived') NOT NULL DEFAULT 'calculated',
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `zakat_assessments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `insurance_claims` ADD CONSTRAINT `insurance_claims_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `insurance_claims` ADD CONSTRAINT `insurance_claims_profileId_financial_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `financial_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `insurance_claims` ADD CONSTRAINT `insurance_claims_policyId_insurance_policies_id_fk` FOREIGN KEY (`policyId`) REFERENCES `insurance_policies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `insurance_claims` ADD CONSTRAINT `insurance_claims_receivedEventId_financial_events_id_fk` FOREIGN KEY (`receivedEventId`) REFERENCES `financial_events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `insurance_claims` ADD CONSTRAINT `insurance_claims_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `personal_ious` ADD CONSTRAINT `personal_ious_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `personal_ious` ADD CONSTRAINT `personal_ious_profileId_financial_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `financial_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `personal_ious` ADD CONSTRAINT `personal_ious_settlementEventId_financial_events_id_fk` FOREIGN KEY (`settlementEventId`) REFERENCES `financial_events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `personal_ious` ADD CONSTRAINT `personal_ious_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vault_documents` ADD CONSTRAINT `vault_documents_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vault_documents` ADD CONSTRAINT `vault_documents_profileId_financial_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `financial_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vault_documents` ADD CONSTRAINT `vault_documents_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `zakat_assessments` ADD CONSTRAINT `zakat_assessments_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `zakat_assessments` ADD CONSTRAINT `zakat_assessments_profileId_financial_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `financial_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `zakat_assessments` ADD CONSTRAINT `zakat_assessments_paymentEventId_financial_events_id_fk` FOREIGN KEY (`paymentEventId`) REFERENCES `financial_events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `zakat_assessments` ADD CONSTRAINT `zakat_assessments_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `insurance_claim_workspace_policy_status_idx` ON `insurance_claims` (`workspaceId`,`policyId`,`status`);--> statement-breakpoint
CREATE INDEX `personal_iou_workspace_status_idx` ON `personal_ious` (`workspaceId`,`status`,`dueAt`);--> statement-breakpoint
CREATE INDEX `vault_document_workspace_link_idx` ON `vault_documents` (`workspaceId`,`linkedEntityType`,`linkedEntityId`);--> statement-breakpoint
CREATE INDEX `vault_document_workspace_created_idx` ON `vault_documents` (`workspaceId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `zakat_assessment_workspace_status_idx` ON `zakat_assessments` (`workspaceId`,`status`,`assessedAt`);