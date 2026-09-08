CREATE TABLE `approval_decisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`requestId` int NOT NULL,
	`decidedByUserId` int NOT NULL,
	`decision` enum('approved','rejected') NOT NULL,
	`note` text,
	`reconfirmedAt` bigint,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `approval_decisions_id` PRIMARY KEY(`id`),
	CONSTRAINT `approval_decision_request_user_unique` UNIQUE(`requestId`,`decidedByUserId`)
);
--> statement-breakpoint
CREATE TABLE `approval_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`actionType` enum('cash_event','budget_adjustment','period_adjustment') NOT NULL,
	`currency` varchar(3) NOT NULL,
	`thresholdAmount` decimal(20,6) NOT NULL,
	`approverRole` enum('advisor','owner') NOT NULL DEFAULT 'advisor',
	`requireSeparateApprover` enum('yes','no') NOT NULL DEFAULT 'yes',
	`requireReconfirmation` enum('yes','no') NOT NULL DEFAULT 'yes',
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `approval_policies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approval_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`policyId` int,
	`requestedByUserId` int NOT NULL,
	`actionType` enum('cash_event','budget_adjustment','period_adjustment') NOT NULL,
	`actionPayload` json NOT NULL,
	`amount` decimal(20,6),
	`currency` varchar(3),
	`status` enum('pending','approved','rejected','cancelled','executed','expired') NOT NULL DEFAULT 'pending',
	`requiredApproverRole` enum('advisor','owner') NOT NULL,
	`expiresAt` bigint,
	`executedEventId` int,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `approval_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `budget_template_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`templateId` int NOT NULL,
	`categoryId` int NOT NULL,
	`plannedAmountBase` decimal(20,6) NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `budget_template_lines_id` PRIMARY KEY(`id`),
	CONSTRAINT `budget_template_line_template_category_unique` UNIQUE(`templateId`,`categoryId`)
);
--> statement-breakpoint
CREATE TABLE `budget_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`name` varchar(140) NOT NULL,
	`horizonMonths` enum('3','6') NOT NULL,
	`startsPeriodKey` varchar(7) NOT NULL,
	`spendingLimitBase` decimal(20,6),
	`status` enum('draft','active','archived') NOT NULL DEFAULT 'draft',
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `budget_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financial_periods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`periodKey` varchar(7) NOT NULL,
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`closedByUserId` int,
	`closedAt` bigint,
	`closeApprovalRequestId` int,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `financial_periods_id` PRIMARY KEY(`id`),
	CONSTRAINT `financial_period_workspace_period_unique` UNIQUE(`workspaceId`,`periodKey`)
);
--> statement-breakpoint
CREATE TABLE `planning_scenarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`profileId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`scenarioType` enum('debt','retirement','emergency','cash_flow') NOT NULL,
	`assumptions` json NOT NULL,
	`result` json NOT NULL,
	`confidence` enum('low','medium','high') NOT NULL DEFAULT 'low',
	`status` enum('draft','active','archived') NOT NULL DEFAULT 'draft',
	`createdByUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `planning_scenarios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `approval_decisions` ADD CONSTRAINT `approval_decisions_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_decisions` ADD CONSTRAINT `approval_decisions_requestId_approval_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `approval_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_decisions` ADD CONSTRAINT `approval_decisions_decidedByUserId_users_id_fk` FOREIGN KEY (`decidedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_policies` ADD CONSTRAINT `approval_policies_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_policies` ADD CONSTRAINT `approval_policies_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_policyId_approval_policies_id_fk` FOREIGN KEY (`policyId`) REFERENCES `approval_policies`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_requestedByUserId_users_id_fk` FOREIGN KEY (`requestedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_executedEventId_financial_events_id_fk` FOREIGN KEY (`executedEventId`) REFERENCES `financial_events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budget_template_lines` ADD CONSTRAINT `budget_template_lines_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budget_template_lines` ADD CONSTRAINT `budget_template_lines_templateId_budget_templates_id_fk` FOREIGN KEY (`templateId`) REFERENCES `budget_templates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budget_template_lines` ADD CONSTRAINT `budget_template_lines_categoryId_cash_flow_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `cash_flow_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budget_templates` ADD CONSTRAINT `budget_templates_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budget_templates` ADD CONSTRAINT `budget_templates_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_periods` ADD CONSTRAINT `financial_periods_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_periods` ADD CONSTRAINT `financial_periods_closedByUserId_users_id_fk` FOREIGN KEY (`closedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_periods` ADD CONSTRAINT `financial_periods_closeApprovalRequestId_approval_requests_id_fk` FOREIGN KEY (`closeApprovalRequestId`) REFERENCES `approval_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `planning_scenarios` ADD CONSTRAINT `planning_scenarios_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `planning_scenarios` ADD CONSTRAINT `planning_scenarios_profileId_financial_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `financial_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `planning_scenarios` ADD CONSTRAINT `planning_scenarios_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `approval_decision_workspace_request_idx` ON `approval_decisions` (`workspaceId`,`requestId`);--> statement-breakpoint
CREATE INDEX `approval_policy_workspace_action_idx` ON `approval_policies` (`workspaceId`,`actionType`,`status`);--> statement-breakpoint
CREATE INDEX `approval_request_workspace_status_idx` ON `approval_requests` (`workspaceId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `approval_request_requester_idx` ON `approval_requests` (`requestedByUserId`);--> statement-breakpoint
CREATE INDEX `budget_template_workspace_status_idx` ON `budget_templates` (`workspaceId`,`status`);--> statement-breakpoint
CREATE INDEX `scenario_workspace_status_idx` ON `planning_scenarios` (`workspaceId`,`status`,`updatedAt`);