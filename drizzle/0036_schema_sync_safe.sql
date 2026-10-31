CREATE TABLE IF NOT EXISTS `bank_certificates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`profileId` int NOT NULL,
	`certificateName` varchar(160) NOT NULL,
	`bankName` varchar(160) NOT NULL,
	`principalAmount` decimal(20,6) NOT NULL,
	`interestRate` decimal(12,6) NOT NULL,
	`payoutFrequency` enum('monthly','quarterly','semi_annual','annual') NOT NULL DEFAULT 'monthly',
	`issueDate` bigint NOT NULL,
	`maturityDate` bigint NOT NULL,
	`linkedPayoutAccountId` int,
	`currency` varchar(3) NOT NULL DEFAULT 'EGP',
	`status` enum('active','matured','redeemed') NOT NULL DEFAULT 'active',
	`lastYieldCollectedAt` bigint,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `bank_certificates_id` PRIMARY KEY(`id`),
	INDEX `bank_certificates_workspace_status_idx` (`workspaceId`,`status`),
	INDEX `bank_certificates_workspace_idx` (`workspaceId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `credit_card_installments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`debtId` int NOT NULL,
	`merchantName` varchar(160) NOT NULL,
	`planName` varchar(160) NOT NULL,
	`totalAmount` decimal(20,6) NOT NULL,
	`monthlyAmount` decimal(20,6) NOT NULL,
	`tenureMonths` int NOT NULL,
	`remainingMonths` int NOT NULL,
	`startDate` bigint NOT NULL,
	`status` enum('active','completed','cancelled') NOT NULL DEFAULT 'active',
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `credit_card_installments_id` PRIMARY KEY(`id`),
	INDEX `cc_installments_workspace_debt_idx` (`workspaceId`,`debtId`,`status`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_registration_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`note` varchar(255),
	`createdByUserId` int,
	`usedByUserId` int,
	`status` enum('active','used','revoked','expired') NOT NULL DEFAULT 'active',
	`maxUses` int NOT NULL DEFAULT 1,
	`usedCount` int NOT NULL DEFAULT 0,
	`expiresAt` bigint,
	`createdAt` bigint NOT NULL,
	`usedAt` bigint,
	CONSTRAINT `user_registration_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_registration_invites_code_unique` UNIQUE(`code`),
	INDEX `user_reg_invites_status_idx` (`status`),
	INDEX `user_reg_invites_creator_idx` (`createdByUserId`)
);

