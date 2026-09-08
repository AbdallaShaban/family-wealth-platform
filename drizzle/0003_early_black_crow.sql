CREATE TABLE `fx_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`fromCurrency` varchar(3) NOT NULL,
	`toCurrency` varchar(3) NOT NULL,
	`rate` decimal(20,10) NOT NULL,
	`source` varchar(120) NOT NULL,
	`rateStatus` enum('manual','live','delayed','last_known') NOT NULL,
	`asOf` bigint NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `fx_rates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `fx_rates` ADD CONSTRAINT `fx_rates_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `fx_rates_pair_asof_idx` ON `fx_rates` (`workspaceId`,`fromCurrency`,`toCurrency`,`asOf`);