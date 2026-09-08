CREATE TABLE `platform_admin_invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`invitedByUserId` int NOT NULL,
	`verifiedUserId` int,
	`reviewedByUserId` int,
	`status` enum('pending_login','awaiting_review','approved','rejected','cancelled','expired') NOT NULL DEFAULT 'pending_login',
	`expiresAt` bigint NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `platform_admin_invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_admin_invite_email_status_unique` UNIQUE(`email`,`status`)
);
--> statement-breakpoint
ALTER TABLE `platform_admin_invitations` ADD CONSTRAINT `platform_admin_invitations_invitedByUserId_users_id_fk` FOREIGN KEY (`invitedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `platform_admin_invitations` ADD CONSTRAINT `platform_admin_invitations_verifiedUserId_users_id_fk` FOREIGN KEY (`verifiedUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `platform_admin_invitations` ADD CONSTRAINT `platform_admin_invitations_reviewedByUserId_users_id_fk` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `platform_admin_invite_status_expiry_idx` ON `platform_admin_invitations` (`status`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `platform_admin_invite_verifier_idx` ON `platform_admin_invitations` (`verifiedUserId`);