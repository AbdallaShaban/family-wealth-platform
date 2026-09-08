CREATE INDEX `accounts_workspace_status_idx` ON `accounts` (`workspaceId`,`status`,`isSystemAccount`);--> statement-breakpoint
CREATE INDEX `events_workspace_status_occurred_idx` ON `financial_events` (`workspaceId`,`status`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `fx_rates_to_from_asof_idx` ON `fx_rates` (`workspaceId`,`toCurrency`,`fromCurrency`,`asOf`);--> statement-breakpoint
CREATE INDEX `positions_workspace_instrument_idx` ON `positions` (`workspaceId`,`instrumentId`);--> statement-breakpoint
CREATE INDEX `quotes_workspace_instrument_asof_idx` ON `price_quotes` (`workspaceId`,`instrumentId`,`asOf`);