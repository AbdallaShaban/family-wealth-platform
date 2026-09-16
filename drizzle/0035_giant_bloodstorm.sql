CREATE TABLE `market_candles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`instrumentId` int NOT NULL,
	`timeframe` enum('1h','4h','1d','1w') NOT NULL DEFAULT '1d',
	`timestamp` bigint NOT NULL,
	`open` decimal(14,4) NOT NULL,
	`high` decimal(14,4) NOT NULL,
	`low` decimal(14,4) NOT NULL,
	`close` decimal(14,4) NOT NULL,
	`volume` decimal(18,2) NOT NULL,
	CONSTRAINT `market_candles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `swing_trades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`instrumentId` int NOT NULL,
	`assetCategory` enum('EGX_STOCK','NBE_MUTUAL_FUND','TELDA_LIQUIDITY','GOLD','CRYPTO_OTHER') NOT NULL DEFAULT 'EGX_STOCK',
	`fundingAccountId` int,
	`isPaperTrading` boolean NOT NULL DEFAULT false,
	`direction` enum('LONG','SHORT') NOT NULL DEFAULT 'LONG',
	`quantity` decimal(14,4) NOT NULL,
	`entryPrice` decimal(14,4) NOT NULL,
	`stopLossPrice` decimal(14,4),
	`takeProfitPrice` decimal(14,4),
	`entryDate` bigint NOT NULL,
	`exitDeadline` bigint,
	`targetHoldingDays` int DEFAULT 10,
	`status` enum('OPEN','TARGET_HIT','STOPPED_OUT','TIME_EXPIRED','CLOSED_MANUALLY','CANCELLED') NOT NULL DEFAULT 'OPEN',
	`exitPrice` decimal(14,4),
	`exitDate` bigint,
	`strategyTag` varchar(100),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `swing_trades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `market_candles` ADD CONSTRAINT `market_candles_instrumentId_instruments_id_fk` FOREIGN KEY (`instrumentId`) REFERENCES `instruments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `swing_trades` ADD CONSTRAINT `swing_trades_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `swing_trades` ADD CONSTRAINT `swing_trades_instrumentId_instruments_id_fk` FOREIGN KEY (`instrumentId`) REFERENCES `instruments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `swing_trades` ADD CONSTRAINT `swing_trades_fundingAccountId_accounts_id_fk` FOREIGN KEY (`fundingAccountId`) REFERENCES `accounts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `market_candles_instrument_tf_ts_idx` ON `market_candles` (`instrumentId`,`timeframe`,`timestamp`);--> statement-breakpoint
CREATE INDEX `swing_trades_workspace_status_idx` ON `swing_trades` (`workspaceId`,`status`);--> statement-breakpoint
CREATE INDEX `swing_trades_workspace_instrument_idx` ON `swing_trades` (`workspaceId`,`instrumentId`);