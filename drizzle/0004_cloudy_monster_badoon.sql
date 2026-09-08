ALTER TABLE `accounts` ADD `accountCode` varchar(64);--> statement-breakpoint
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_workspace_code_unique` UNIQUE(`workspaceId`,`accountCode`);