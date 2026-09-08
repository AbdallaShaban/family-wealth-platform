ALTER TABLE `platform_admin_invitations` ADD `emailDeliveryStatus` enum('not_attempted','sent','not_configured','failed') DEFAULT 'not_attempted' NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_admin_invitations` ADD `lastEmailAttemptAt` bigint;--> statement-breakpoint
ALTER TABLE `platform_admin_invitations` ADD `lastEmailSentAt` bigint;