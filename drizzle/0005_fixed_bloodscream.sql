ALTER TABLE `workspaces` ADD `personalOwnerUserId` int;--> statement-breakpoint
ALTER TABLE `workspaces` ADD CONSTRAINT `workspaces_personal_owner_unique` UNIQUE(`personalOwnerUserId`);--> statement-breakpoint
ALTER TABLE `workspaces` ADD CONSTRAINT `workspaces_personalOwnerUserId_users_id_fk` FOREIGN KEY (`personalOwnerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;