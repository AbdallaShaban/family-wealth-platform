import {
  bigint,
  boolean,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Domain model: FAMILY is a scoped financial system, not a shared dashboard.
 * All financial records carry workspace ownership. Money is stored as DECIMAL,
 * never as a floating-point value, and balances are projections of journal lines.
 */

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  activeWorkspaceId: int("activeWorkspaceId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/**
 * A singleton platform-level ownership record. It is intentionally separate
 * from workspace memberships: a FAMILY workspace owner governs one workspace,
 * while this record identifies the first verified Google/Gmail administrator
 * who can manage the application-wide administrator role.
 */
export const platformOwnership = mysqlTable("platform_ownership", {
  id: int("id").primaryKey(),
  ownerUserId: int("ownerUserId").notNull().references(() => users.id),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
});

export const platformAuditEvents = mysqlTable(
  "platform_audit_events",
  {
    id: int("id").autoincrement().primaryKey(),
    actorUserId: int("actorUserId").notNull().references(() => users.id),
    targetUserId: int("targetUserId").references(() => users.id),
    action: varchar("action", { length: 120 }).notNull(),
    beforeState: json("beforeState"),
    afterState: json("afterState"),
    occurredAt: bigint("occurredAt", { mode: "number" }).notNull(),
  },
  table => ({
    occurredIndex: index("platform_audit_occurred_idx").on(table.occurredAt),
    targetIndex: index("platform_audit_target_idx").on(table.targetUserId),
  })
);

export const platformAdminInvitations = mysqlTable(
  "platform_admin_invitations",
  {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    invitedByUserId: int("invitedByUserId").notNull().references(() => users.id),
    verifiedUserId: int("verifiedUserId").references(() => users.id),
    reviewedByUserId: int("reviewedByUserId").references(() => users.id),
    status: mysqlEnum("status", ["pending_login", "awaiting_review", "approved", "rejected", "cancelled", "expired"]).default("pending_login").notNull(),
    emailDeliveryStatus: mysqlEnum("emailDeliveryStatus", ["not_attempted", "sent", "not_configured", "failed"]).default("not_attempted").notNull(),
    lastEmailAttemptAt: bigint("lastEmailAttemptAt", { mode: "number" }),
    lastEmailSentAt: bigint("lastEmailSentAt", { mode: "number" }),
    expiresAt: bigint("expiresAt", { mode: "number" }).notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    emailStatusIndex: index("platform_admin_invite_email_status_idx").on(table.email, table.status),
    statusExpiryIndex: index("platform_admin_invite_status_expiry_idx").on(table.status, table.expiresAt),
    verifierIndex: index("platform_admin_invite_verifier_idx").on(table.verifiedUserId),
  })
);

export const workspaces = mysqlTable(
  "workspaces",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    baseCurrency: varchar("baseCurrency", { length: 3 }).default("EGP").notNull(),
    paperTradingBalance: decimal("paperTradingBalance", { precision: 20, scale: 6 }).default("1000000.000000"),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    personalOwnerUserId: int("personalOwnerUserId").references(() => users.id),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    creatorIndex: index("workspaces_creator_idx").on(table.createdByUserId),
    personalOwnerUnique: uniqueIndex("workspaces_personal_owner_unique").on(table.personalOwnerUserId),
  })
);

export const memberships = mysqlTable(
  "memberships",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", ["owner", "advisor", "editor", "viewer"]).default("viewer").notNull(),
    status: mysqlEnum("status", ["active", "invited", "suspended"]).default("active").notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceUserUnique: uniqueIndex("memberships_workspace_user_unique").on(table.workspaceId, table.userId),
    userIndex: index("memberships_user_idx").on(table.userId),
  })
);

export const workspaceInvitations = mysqlTable(
  "workspace_invitations",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    invitedByUserId: int("invitedByUserId").notNull().references(() => users.id),
    email: varchar("email", { length: 320 }).notNull(),
    role: mysqlEnum("role", ["advisor", "editor", "viewer"]).default("viewer").notNull(),
    status: mysqlEnum("status", ["pending", "accepted", "cancelled", "expired"]).default("pending").notNull(),
    expiresAt: bigint("expiresAt", { mode: "number" }).notNull(),
    acceptedByUserId: int("acceptedByUserId").references(() => users.id),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceEmailStatusUnique: uniqueIndex("invitations_workspace_email_status_unique").on(table.workspaceId, table.email, table.status),
    emailStatusIndex: index("invitations_email_status_idx").on(table.email, table.status),
  })
);

export const financialProfiles = mysqlTable(
  "financial_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    displayName: varchar("displayName", { length: 160 }).notNull(),
    relationship: mysqlEnum("relationship", ["self", "spouse", "child", "parent", "advisor", "other"]).default("self").notNull(),
    isFinancialOwner: mysqlEnum("isFinancialOwner", ["yes", "no"]).default("yes").notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceUserUnique: uniqueIndex("profiles_workspace_user_unique").on(table.workspaceId, table.userId),
    workspaceIndex: index("profiles_workspace_idx").on(table.workspaceId),
  })
);

export const accounts = mysqlTable(
  "accounts",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    ownerProfileId: int("ownerProfileId").references(() => financialProfiles.id),
    name: varchar("name", { length: 160 }).notNull(),
    accountCode: varchar("accountCode", { length: 64 }),
    accountType: mysqlEnum("accountType", ["cash", "bank", "brokerage", "wallet", "credit", "loan", "asset", "equity", "income", "expense", "clearing"]).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    institution: varchar("institution", { length: 160 }),
    status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(),
    isSystemAccount: mysqlEnum("isSystemAccount", ["yes", "no"]).default("no").notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceIndex: index("accounts_workspace_idx").on(table.workspaceId),
    workspaceStatusIndex: index("accounts_workspace_status_idx").on(table.workspaceId, table.status, table.isSystemAccount),
    ownerIndex: index("accounts_owner_idx").on(table.ownerProfileId),
    workspaceCodeUnique: uniqueIndex("accounts_workspace_code_unique").on(table.workspaceId, table.accountCode),
  })
);

export const instruments = mysqlTable(
  "instruments",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    symbol: varchar("symbol", { length: 48 }),
    name: varchar("name", { length: 200 }).notNull(),
    assetType: mysqlEnum("assetType", ["equity", "fund", "bond", "gold", "real_estate", "cash_equivalent", "other"]).notNull(),
    subCategory: varchar("subCategory", { length: 100 }),
    sector: varchar("sector", { length: 100 }),
    currency: varchar("currency", { length: 3 }).notNull(),
    isin: varchar("isin", { length: 32 }),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceSymbolUnique: uniqueIndex("instruments_workspace_symbol_unique").on(table.workspaceId, table.symbol),
    workspaceIndex: index("instruments_workspace_idx").on(table.workspaceId),
  })
);

export const cashFlowCategories = mysqlTable(
  "cash_flow_categories",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    direction: mysqlEnum("direction", ["income", "expense"]).notNull(),
    color: varchar("color", { length: 16 }),
    isEssential: mysqlEnum("isEssential", ["yes", "no"]).default("no").notNull(),
    isArchived: mysqlEnum("isArchived", ["yes", "no"]).default("no").notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceDirectionNameUnique: uniqueIndex("categories_workspace_direction_name_unique").on(table.workspaceId, table.direction, table.name),
  })
);

export const financialEvents = mysqlTable(
  "financial_events",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    profileId: int("profileId").notNull().references(() => financialProfiles.id),
    primaryAccountId: int("primaryAccountId").references(() => accounts.id),
    counterAccountId: int("counterAccountId").references(() => accounts.id),
    instrumentId: int("instrumentId").references(() => instruments.id),
    categoryId: int("categoryId").references(() => cashFlowCategories.id),
    eventType: mysqlEnum("eventType", ["opening_balance", "deposit", "withdrawal", "transfer", "position_transfer", "corporate_action", "buy", "sell", "dividend", "income", "expense", "fee", "tax", "adjustment", "reversal", "debt_origination", "debt_payment"]).notNull(),
    status: mysqlEnum("status", ["draft", "validated", "posted", "reversed", "void"]).default("draft").notNull(),
    occurredAt: bigint("occurredAt", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    grossAmount: decimal("grossAmount", { precision: 20, scale: 6 }).notNull(),
    feeAmount: decimal("feeAmount", { precision: 20, scale: 6 }).default("0").notNull(),
    taxAmount: decimal("taxAmount", { precision: 20, scale: 6 }).default("0").notNull(),
    quantity: decimal("quantity", { precision: 24, scale: 8 }),
    unitPrice: decimal("unitPrice", { precision: 20, scale: 8 }),
    externalRef: varchar("externalRef", { length: 160 }),
    idempotencyKey: varchar("idempotencyKey", { length: 160 }).notNull(),
    source: mysqlEnum("source", ["manual", "imported", "api", "system_generated"]).default("manual").notNull(),
    memo: text("memo"),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceOccurredIndex: index("events_workspace_occurred_idx").on(table.workspaceId, table.occurredAt),
    workspaceStatusOccurredIndex: index("events_workspace_status_occurred_idx").on(table.workspaceId, table.status, table.occurredAt),
    accountIndex: index("events_account_idx").on(table.primaryAccountId),
    counterAccountIndex: index("events_counter_account_idx").on(table.counterAccountId),
    idempotencyUnique: uniqueIndex("events_workspace_idempotency_unique").on(table.workspaceId, table.idempotencyKey),
    externalRefUnique: uniqueIndex("events_workspace_external_ref_unique").on(table.workspaceId, table.externalRef),
  })
);

export const budgets = mysqlTable(
  "budgets",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    categoryId: int("categoryId").notNull().references(() => cashFlowCategories.id, { onDelete: "cascade" }),
    periodKey: varchar("periodKey", { length: 7 }).notNull(),
    plannedAmountBase: decimal("plannedAmountBase", { precision: 20, scale: 6 }).notNull(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceCategoryPeriodUnique: uniqueIndex("budgets_workspace_category_period_unique").on(table.workspaceId, table.categoryId, table.periodKey),
    workspacePeriodIndex: index("budgets_workspace_period_idx").on(table.workspaceId, table.periodKey),
  })
);

export const recurringRules = mysqlTable(
  "recurring_rules",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    profileId: int("profileId").notNull().references(() => financialProfiles.id),
    accountId: int("accountId").notNull().references(() => accounts.id),
    categoryId: int("categoryId").references(() => cashFlowCategories.id),
    eventType: mysqlEnum("eventType", ["income", "expense", "deposit", "withdrawal"]).notNull(),
    amount: decimal("amount", { precision: 20, scale: 6 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    cadence: mysqlEnum("cadence", [
      "weekly",
      "monthly",
      "quarterly",
      "semi_annual",
      "yearly",
      "WEEKLY",
      "MONTHLY",
      "QUARTERLY",
      "SEMI_ANNUAL",
      "ANNUALLY",
    ]).notNull(),
    subscriptionTag: varchar("subscriptionTag", { length: 64 }),
    renewalNotificationDays: int("renewalNotificationDays").default(3),
    nextRunAt: bigint("nextRunAt", { mode: "number" }).notNull(),
    endsAt: bigint("endsAt", { mode: "number" }),
    status: mysqlEnum("status", ["active", "paused", "completed"]).default("active").notNull(),
    memo: text("memo"),
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceNextRunIndex: index("recurring_workspace_next_run_idx").on(table.workspaceId, table.status, table.nextRunAt),
    cronTaskIndex: index("recurring_schedule_task_uid_idx").on(table.scheduleCronTaskUid),
  })
);

export const debts = mysqlTable(
  "debts",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    profileId: int("profileId").notNull().references(() => financialProfiles.id),
    liabilityAccountId: int("liabilityAccountId").notNull().references(() => accounts.id),
    name: varchar("name", { length: 160 }).notNull(),
    lender: varchar("lender", { length: 160 }),
    debtType: mysqlEnum("debtType", ["loan", "credit_card", "mortgage", "personal", "other"]).notNull(),
    creditLimit: decimal("creditLimit", { precision: 20, scale: 6 }),
    billingCycleDay: int("billingCycleDay"),
    gracePeriodDays: int("gracePeriodDays"),
    interestFreeDueDate: bigint("interestFreeDueDate", { mode: "number" }),
    originalPrincipal: decimal("originalPrincipal", { precision: 20, scale: 6 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    annualInterestRate: decimal("annualInterestRate", { precision: 12, scale: 6 }).default("0").notNull(),
    minimumPayment: decimal("minimumPayment", { precision: 20, scale: 6 }).notNull(),
    paymentDay: int("paymentDay"),
    startDate: bigint("startDate", { mode: "number" }).notNull(),
    maturityDate: bigint("maturityDate", { mode: "number" }),
    cashFlowCategoryId: int("cashFlowCategoryId").references(() => cashFlowCategories.id),
    status: mysqlEnum("status", ["active", "paid", "archived"]).default("active").notNull(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceStatusIndex: index("debts_workspace_status_idx").on(table.workspaceId, table.status),
    liabilityAccountUnique: uniqueIndex("debts_liability_account_unique").on(table.liabilityAccountId),
  })
);

export const debtPayments = mysqlTable(
  "debt_payments",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    debtId: int("debtId").notNull().references(() => debts.id, { onDelete: "cascade" }),
    financialEventId: int("financialEventId").notNull().references(() => financialEvents.id),
    cashAccountId: int("cashAccountId").notNull().references(() => accounts.id),
    principalAmount: decimal("principalAmount", { precision: 20, scale: 6 }).notNull(),
    interestAmount: decimal("interestAmount", { precision: 20, scale: 6 }).default("0").notNull(),
    feeAmount: decimal("feeAmount", { precision: 20, scale: 6 }).default("0").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    occurredAt: bigint("occurredAt", { mode: "number" }).notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceDebtIndex: index("debt_payments_workspace_debt_idx").on(table.workspaceId, table.debtId, table.occurredAt),
    eventUnique: uniqueIndex("debt_payments_event_unique").on(table.financialEventId),
  })
);

export const emergencyFundPlans = mysqlTable(
  "emergency_fund_plans",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    profileId: int("profileId").notNull().references(() => financialProfiles.id),
    targetMonths: decimal("targetMonths", { precision: 8, scale: 2 }).notNull(),
    lookbackMonths: int("lookbackMonths").default(3).notNull(),
    targetDate: bigint("targetDate", { mode: "number" }),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceProfileUnique: uniqueIndex("emergency_fund_workspace_profile_unique").on(table.workspaceId, table.profileId),
  })
);

export const journalEntries = mysqlTable(
  "journal_entries",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    eventId: int("eventId").notNull().references(() => financialEvents.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", ["posted", "reversed"]).default("posted").notNull(),
    postedAt: bigint("postedAt", { mode: "number" }).notNull(),
    reversalOfEntryId: int("reversalOfEntryId"),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceIndex: index("journal_entries_workspace_idx").on(table.workspaceId),
    eventUnique: uniqueIndex("journal_entries_event_unique").on(table.eventId),
  })
);

export const journalLines = mysqlTable(
  "journal_lines",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    entryId: int("entryId").notNull().references(() => journalEntries.id, { onDelete: "cascade" }),
    accountId: int("accountId").notNull().references(() => accounts.id),
    direction: mysqlEnum("direction", ["debit", "credit"]).notNull(),
    amount: decimal("amount", { precision: 20, scale: 6 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    fxRateToBase: decimal("fxRateToBase", { precision: 20, scale: 10 }).default("1").notNull(),
    baseAmount: decimal("baseAmount", { precision: 20, scale: 6 }).notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceAccountIndex: index("journal_lines_workspace_account_idx").on(table.workspaceId, table.accountId),
    entryIndex: index("journal_lines_entry_idx").on(table.entryId),
  })
);

export const positions = mysqlTable(
  "positions",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    accountId: int("accountId").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    instrumentId: int("instrumentId").notNull().references(() => instruments.id),
    quantity: decimal("quantity", { precision: 24, scale: 8 }).default("0").notNull(),
    averageCost: decimal("averageCost", { precision: 20, scale: 8 }).default("0").notNull(),
    costCurrency: varchar("costCurrency", { length: 3 }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    accountInstrumentUnique: uniqueIndex("positions_account_instrument_unique").on(table.accountId, table.instrumentId),
    workspaceIndex: index("positions_workspace_idx").on(table.workspaceId),
    workspaceInstrumentIndex: index("positions_workspace_instrument_idx").on(table.workspaceId, table.instrumentId),
  })
);

export const priceQuotes = mysqlTable(
  "price_quotes",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    instrumentId: int("instrumentId").notNull().references(() => instruments.id, { onDelete: "cascade" }),
    price: decimal("price", { precision: 20, scale: 8 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    source: varchar("source", { length: 120 }).notNull(),
    quoteStatus: mysqlEnum("quoteStatus", ["live", "delayed", "last_known", "manual", "unavailable"]).notNull(),
    asOf: bigint("asOf", { mode: "number" }).notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  },
  table => ({
    instrumentAsOfIndex: index("quotes_instrument_asof_idx").on(table.instrumentId, table.asOf),
    workspaceInstrumentAsOfIndex: index("quotes_workspace_instrument_asof_idx").on(table.workspaceId, table.instrumentId, table.asOf),
  })
);

export const valuationProvenance = mysqlTable(
  "valuation_provenance",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    sourceType: mysqlEnum("sourceType", ["market_provider", "manual", "derived"]).notNull(),
    provider: varchar("provider", { length: 120 }).notNull(),
    source: varchar("source", { length: 160 }).notNull(),
    rawSymbol: varchar("rawSymbol", { length: 120 }),
    normalizedSymbol: varchar("normalizedSymbol", { length: 120 }),
    fetchedAt: bigint("fetchedAt", { mode: "number" }),
    asOf: bigint("asOf", { mode: "number" }),
    status: mysqlEnum("status", ["live", "delayed", "last_known", "manual", "unavailable"]).notNull(),
    responseHash: varchar("responseHash", { length: 128 }),
    metadata: json("metadata"),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  },
  table => ({ workspaceAsOfIndex: index("valuation_provenance_workspace_asof_idx").on(table.workspaceId, table.asOf), symbolIndex: index("valuation_provenance_symbol_idx").on(table.workspaceId, table.normalizedSymbol) })
);

export const valuationSnapshots = mysqlTable(
  "valuation_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    subjectType: mysqlEnum("subjectType", ["instrument", "account", "special_asset", "net_worth"]).notNull(),
    subjectId: int("subjectId"),
    provenanceId: int("provenanceId").notNull().references(() => valuationProvenance.id),
    quoteId: int("quoteId").references(() => priceQuotes.id),
    fxRateId: int("fxRateId").references(() => fxRates.id),
    nativeValue: decimal("nativeValue", { precision: 24, scale: 8 }).notNull(),
    nativeCurrency: varchar("nativeCurrency", { length: 3 }).notNull(),
    baseValue: decimal("baseValue", { precision: 24, scale: 8 }),
    baseCurrency: varchar("baseCurrency", { length: 3 }).notNull(),
    quantity: decimal("quantity", { precision: 24, scale: 8 }),
    unit: varchar("unit", { length: 48 }),
    valuationMethod: mysqlEnum("valuationMethod", ["market_quote", "fx_converted", "manual", "derived"]).notNull(),
    quality: mysqlEnum("quality", ["current", "delayed", "stale", "manual", "unavailable"]).notNull(),
    asOf: bigint("asOf", { mode: "number" }).notNull(),
    capturedAt: bigint("capturedAt", { mode: "number" }).notNull(),
    createdByUserId: int("createdByUserId").references(() => users.id),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  },
  table => ({ workspaceSubjectAsOfIndex: index("valuation_snapshots_workspace_subject_asof_idx").on(table.workspaceId, table.subjectType, table.subjectId, table.asOf), provenanceIndex: index("valuation_snapshots_provenance_idx").on(table.provenanceId), quoteIndex: index("valuation_snapshots_quote_idx").on(table.quoteId) })
);

export const officialValuationSnapshots = mysqlTable(
  "official_valuation_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    valuationAsOf: bigint("valuationAsOf", { mode: "number" }).notNull(),
    capturedAt: bigint("capturedAt", { mode: "number" }).notNull(),
    baseCurrency: varchar("baseCurrency", { length: 3 }).notNull(),
    status: mysqlEnum("status", ["official", "review_required", "unavailable"]).notNull(),
    quality: mysqlEnum("quality", ["current", "delayed", "stale", "manual", "unavailable"]).notNull(),
    netWorthBase: decimal("netWorthBase", { precision: 24, scale: 8 }),
    liquidBalanceBase: decimal("liquidBalanceBase", { precision: 24, scale: 8 }),
    investmentValueBase: decimal("investmentValueBase", { precision: 24, scale: 8 }),
    liabilityBalanceBase: decimal("liabilityBalanceBase", { precision: 24, scale: 8 }),
    unrealizedPnlBase: decimal("unrealizedPnlBase", { precision: 24, scale: 8 }),
    componentSnapshotIds: json("componentSnapshotIds").notNull(),
    sourceSummary: json("sourceSummary").notNull(),
    warnings: json("warnings").notNull(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceCapturedIndex: index("official_valuation_workspace_captured_idx").on(table.workspaceId, table.capturedAt),
    workspaceAsOfIndex: index("official_valuation_workspace_asof_idx").on(table.workspaceId, table.valuationAsOf),
  })
);

export const fxRates = mysqlTable(
  "fx_rates",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    fromCurrency: varchar("fromCurrency", { length: 3 }).notNull(),
    toCurrency: varchar("toCurrency", { length: 3 }).notNull(),
    rate: decimal("rate", { precision: 20, scale: 10 }).notNull(),
    source: varchar("source", { length: 120 }).notNull(),
    rateStatus: mysqlEnum("rateStatus", ["manual", "live", "delayed", "last_known"]).notNull(),
    asOf: bigint("asOf", { mode: "number" }).notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  },
  table => ({
    pairAsOfIndex: index("fx_rates_pair_asof_idx").on(table.workspaceId, table.fromCurrency, table.toCurrency, table.asOf),
    workspaceToFromAsOfIndex: index("fx_rates_to_from_asof_idx").on(table.workspaceId, table.toCurrency, table.fromCurrency, table.asOf),
  })
);

export const financialGoals = mysqlTable(
  "financial_goals",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    profileId: int("profileId").references(() => financialProfiles.id, { onDelete: "set null" }),
    name: varchar("name", { length: 160 }).notNull(),
    goalType: mysqlEnum("goalType", ["emergency_fund", "retirement", "education", "legacy", "custom"]).notNull(),
    metric: mysqlEnum("metric", ["net_worth", "liquid_assets", "investments"]).notNull(),
    targetAmount: decimal("targetAmount", { precision: 20, scale: 6 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    targetDate: bigint("targetDate", { mode: "number" }),
    priority: int("priority").default(3).notNull(),
    fundingSource: mysqlEnum("fundingSource", ["cash_flow", "savings", "investments", "mixed", "other"]).default("cash_flow").notNull(),
    monthlyContribution: decimal("monthlyContribution", { precision: 20, scale: 6 }).default("0").notNull(),
    assumedAnnualReturn: decimal("assumedAnnualReturn", { precision: 12, scale: 6 }).default("0").notNull(),
    assumedAnnualInflation: decimal("assumedAnnualInflation", { precision: 12, scale: 6 }).default("0").notNull(),
    status: mysqlEnum("status", ["active", "paused", "completed", "archived"]).default("active").notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceStatusIndex: index("goals_workspace_status_idx").on(table.workspaceId, table.status),
  })
);

export const retirementPlans = mysqlTable(
  "retirement_plans",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    profileId: int("profileId").notNull().references(() => financialProfiles.id),
    currentAge: int("currentAge").notNull(),
    retirementAge: int("retirementAge").notNull(),
    currentRetirementAssets: decimal("currentRetirementAssets", { precision: 20, scale: 6 }).notNull(),
    monthlyContribution: decimal("monthlyContribution", { precision: 20, scale: 6 }).notNull(),
    annualSpending: decimal("annualSpending", { precision: 20, scale: 6 }).notNull(),
    safeWithdrawalRate: decimal("safeWithdrawalRate", { precision: 12, scale: 6 }).notNull(),
    assumedAnnualReturn: decimal("assumedAnnualReturn", { precision: 12, scale: 6 }).notNull(),
    assumedAnnualInflation: decimal("assumedAnnualInflation", { precision: 12, scale: 6 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceProfileUnique: uniqueIndex("retirement_workspace_profile_unique").on(table.workspaceId, table.profileId),
  })
);

export const riskProfiles = mysqlTable(
  "risk_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    profileId: int("profileId").notNull().references(() => financialProfiles.id),
    riskLevel: mysqlEnum("riskLevel", ["conservative", "moderate", "growth", "aggressive"]).notNull(),
    questionnaireScore: int("questionnaireScore"),
    rationale: text("rationale"),
    completedAt: bigint("completedAt", { mode: "number" }).notNull(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceProfileUnique: uniqueIndex("risk_profile_workspace_profile_unique").on(table.workspaceId, table.profileId),
  })
);

export const allocationTargets = mysqlTable(
  "allocation_targets",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    profileId: int("profileId").notNull().references(() => financialProfiles.id),
    assetClass: mysqlEnum("assetClass", ["cash", "equity", "fixed_income", "alternatives", "other"]).notNull(),
    targetPercent: decimal("targetPercent", { precision: 8, scale: 4 }).notNull(),
    driftThresholdPercent: decimal("driftThresholdPercent", { precision: 8, scale: 4 }).default("5").notNull(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceIndex: index("allocation_targets_workspace_idx").on(table.workspaceId),
    workspaceProfileAssetClassUnique: uniqueIndex("allocation_workspace_profile_asset_class_unique").on(table.workspaceId, table.profileId, table.assetClass),
  })
);

export const watchlistItems = mysqlTable(
  "watchlist_items",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    profileId: int("profileId").notNull().references(() => financialProfiles.id),
    instrumentId: int("instrumentId").notNull().references(() => instruments.id, { onDelete: "cascade" }),
    note: text("note"),
    status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceProfileInstrumentUnique: uniqueIndex("watchlist_workspace_profile_instrument_unique").on(table.workspaceId, table.profileId, table.instrumentId),
    workspaceStatusIndex: index("watchlist_workspace_status_idx").on(table.workspaceId, table.status),
  })
);

/** Opt-in market review emails are separate from the financial ledger. */
export const marketEmailPreferences = mysqlTable(
  "market_email_preferences",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    origin: varchar("origin", { length: 2_048 }).notNull(),
    enabled: mysqlEnum("enabled", ["yes", "no"]).default("no").notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceUserUnique: uniqueIndex("market_email_preferences_workspace_user_unique").on(table.workspaceId, table.userId),
    enabledIndex: index("market_email_preferences_enabled_idx").on(table.enabled),
  })
);

/** A fingerprint is the durable idempotency key for scheduled email delivery. */
export const marketEmailDeliveries = mysqlTable(
  "market_email_deliveries",
  {
    id: int("id").autoincrement().primaryKey(),
    preferenceId: int("preferenceId").notNull().references(() => marketEmailPreferences.id, { onDelete: "cascade" }),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    signalFingerprint: varchar("signalFingerprint", { length: 64 }).notNull(),
    status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending").notNull(),
    attemptedAt: bigint("attemptedAt", { mode: "number" }).notNull(),
    sentAt: bigint("sentAt", { mode: "number" }),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    preferenceFingerprintUnique: uniqueIndex("market_email_deliveries_preference_fingerprint_unique").on(table.preferenceId, table.signalFingerprint),
    workspaceAttemptIndex: index("market_email_deliveries_workspace_attempt_idx").on(table.workspaceId, table.attemptedAt),
  })
);

export const researchNotes = mysqlTable(
  "research_notes",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    profileId: int("profileId").notNull().references(() => financialProfiles.id),
    instrumentId: int("instrumentId").references(() => instruments.id, { onDelete: "set null" }),
    title: varchar("title", { length: 180 }).notNull(),
    thesis: text("thesis").notNull(),
    risks: text("risks"),
    sourceUrl: varchar("sourceUrl", { length: 2048 }),
    status: mysqlEnum("status", ["draft", "active", "archived"]).default("draft").notNull(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceStatusIndex: index("research_workspace_status_idx").on(table.workspaceId, table.status),
  })
);

export const feeTaxRules = mysqlTable(
  "fee_tax_rules",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    profileId: int("profileId").notNull().references(() => financialProfiles.id),
    name: varchar("name", { length: 160 }).notNull(),
    chargeType: mysqlEnum("chargeType", ["fee", "tax"]).notNull(),
    appliesTo: mysqlEnum("appliesTo", ["buy", "sell", "both"]).notNull(),
    calculationMethod: mysqlEnum("calculationMethod", ["flat", "percentage"]).notNull(),
    value: decimal("value", { precision: 20, scale: 8 }).notNull(),
    currency: varchar("currency", { length: 3 }),
    jurisdictionNote: text("jurisdictionNote"),
    status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceProfileStatusIndex: index("fee_tax_rules_workspace_profile_status_idx").on(table.workspaceId, table.profileId, table.status),
  })
);

export const specialAssets = mysqlTable(
  "special_assets",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    profileId: int("profileId").notNull().references(() => financialProfiles.id),
    assetAccountId: int("assetAccountId").notNull().references(() => accounts.id),
    assetType: mysqlEnum("assetType", ["real_estate", "gold", "commodity", "other"]).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    quantity: decimal("quantity", { precision: 24, scale: 8 }),
    unit: varchar("unit", { length: 48 }),
    ownershipType: mysqlEnum("ownershipType", ["sole", "joint", "usufruct", "other"]).default("sole").notNull(),
    ownershipShare: decimal("ownershipShare", { precision: 8, scale: 5 }).default("100").notNull(),
    acquisitionDate: bigint("acquisitionDate", { mode: "number" }),
    acquisitionCost: decimal("acquisitionCost", { precision: 20, scale: 6 }),
    acquisitionCurrency: varchar("acquisitionCurrency", { length: 3 }),
    location: varchar("location", { length: 255 }),
    marketSymbol: varchar("marketSymbol", { length: 48 }),
    purity: decimal("purity", { precision: 10, scale: 6 }),
    valuationMethod: mysqlEnum("valuationMethod", ["ledger_balance", "market_quote", "manual", "appraisal"]).default("ledger_balance").notNull(),
    valuationSource: varchar("valuationSource", { length: 255 }),
    valuationAsOf: bigint("valuationAsOf", { mode: "number" }),
    valuationStatus: mysqlEnum("valuationStatus", ["unvalued", "current", "stale", "review_required"]).default("unvalued").notNull(),
    valuationNote: text("valuationNote"),
    details: text("details"),
    status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({ assetAccountUnique: uniqueIndex("special_assets_account_unique").on(table.assetAccountId), workspaceStatusIndex: index("special_assets_workspace_status_idx").on(table.workspaceId, table.status), valuationStatusIndex: index("special_assets_valuation_status_idx").on(table.workspaceId, table.valuationStatus, table.valuationAsOf) })
);

export const specialAssetValuations = mysqlTable(
  "special_asset_valuations",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    profileId: int("profileId").notNull().references(() => financialProfiles.id),
    assetId: int("assetId").notNull().references(() => specialAssets.id, { onDelete: "cascade" }),
    financialEventId: int("financialEventId").references(() => financialEvents.id, { onDelete: "set null" }),
    valuationMethod: mysqlEnum("valuationMethod", ["market_quote", "manual", "appraisal"]).notNull(),
    value: decimal("value", { precision: 20, scale: 6 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    marketSymbol: varchar("marketSymbol", { length: 48 }),
    source: varchar("source", { length: 255 }).notNull(),
    quoteValue: decimal("quoteValue", { precision: 20, scale: 8 }),
    quoteCurrency: varchar("quoteCurrency", { length: 3 }),
    asOf: bigint("asOf", { mode: "number" }).notNull(),
    quality: mysqlEnum("quality", ["fresh", "delayed", "manual", "stale", "review_required"]).notNull(),
    note: text("note"),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  },
  table => ({ assetAsOfIndex: index("special_asset_valuations_asset_asof_idx").on(table.assetId, table.asOf), workspaceIndex: index("special_asset_valuations_workspace_idx").on(table.workspaceId, table.asOf) })
);

export const insurancePolicies = mysqlTable(
  "insurance_policies",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    profileId: int("profileId").notNull().references(() => financialProfiles.id),
    name: varchar("name", { length: 200 }).notNull(),
    policyType: mysqlEnum("policyType", ["health", "life", "property", "motor", "other"]).notNull(),
    insurer: varchar("insurer", { length: 160 }),
    policyNumber: varchar("policyNumber", { length: 160 }),
    coverageAmount: decimal("coverageAmount", { precision: 20, scale: 6 }),
    currency: varchar("currency", { length: 3 }).notNull(),
    premiumAmount: decimal("premiumAmount", { precision: 20, scale: 6 }),
    premiumCadence: mysqlEnum("premiumCadence", ["monthly", "quarterly", "yearly", "other"]),
    cashFlowCategoryId: int("cashFlowCategoryId").references(() => cashFlowCategories.id),
    startsAt: bigint("startsAt", { mode: "number" }),
    endsAt: bigint("endsAt", { mode: "number" }),
    renewalAt: bigint("renewalAt", { mode: "number" }),
    premiumDueDay: int("premiumDueDay"),
    deductibleAmount: decimal("deductibleAmount", { precision: 20, scale: 6 }),
    deductibleCurrency: varchar("deductibleCurrency", { length: 3 }),
    providerContact: varchar("providerContact", { length: 255 }),
    policyTerms: text("policyTerms"),
    beneficiaries: text("beneficiaries"),
    claimsNote: text("claimsNote"),
    status: mysqlEnum("status", ["active", "expired", "archived"]).default("active").notNull(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({ workspaceStatusIndex: index("insurance_workspace_status_idx").on(table.workspaceId, table.status) })
);

export const insurancePremiumPayments = mysqlTable(
  "insurance_premium_payments",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    profileId: int("profileId").notNull().references(() => financialProfiles.id),
    policyId: int("policyId").notNull().references(() => insurancePolicies.id),
    financialEventId: int("financialEventId").notNull().references(() => financialEvents.id),
    cashAccountId: int("cashAccountId").notNull().references(() => accounts.id),
    amount: decimal("amount", { precision: 20, scale: 6 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    occurredAt: bigint("occurredAt", { mode: "number" }).notNull(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  },
  table => ({
    financialEventUnique: uniqueIndex("insurance_premium_event_unique").on(table.financialEventId),
    policyOccurredIndex: index("insurance_premium_policy_occurred_idx").on(table.policyId, table.occurredAt),
    workspaceProfileIndex: index("insurance_premium_workspace_profile_idx").on(table.workspaceId, table.profileId),
  })
);

/**
 * Import inbox: raw bank statement files and their parsed rows are deliberately
 * separate from the ledger. A row can only reach financialEvents after a user
 * has reviewed its mapping and explicitly requested posting.
 */
export const bankStatementImports = mysqlTable(
  "bank_statement_imports",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    accountId: int("accountId").notNull().references(() => accounts.id),
    originalFilename: varchar("originalFilename", { length: 255 }).notNull(),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    contentHash: varchar("contentHash", { length: 64 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    columnMapping: json("columnMapping").notNull(),
    status: mysqlEnum("status", ["review", "ready", "posting", "posted", "failed"]).default("review").notNull(),
    rowCount: int("rowCount").default(0).notNull(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceStatusIndex: index("bank_import_workspace_status_idx").on(table.workspaceId, table.status, table.createdAt),
    workspaceHashIndex: index("bank_import_workspace_hash_idx").on(table.workspaceId, table.contentHash),
  })
);

export const bankStatementRows = mysqlTable(
  "bank_statement_rows",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    importId: int("importId").notNull().references(() => bankStatementImports.id, { onDelete: "cascade" }),
    sourceRowNumber: int("sourceRowNumber").notNull(),
    rawData: json("rawData").notNull(),
    occurredAt: bigint("occurredAt", { mode: "number" }),
    description: text("description"),
    amount: decimal("amount", { precision: 20, scale: 6 }),
    currency: varchar("currency", { length: 3 }).notNull(),
    externalRef: varchar("externalRef", { length: 160 }),
    classification: mysqlEnum("classification", ["income", "expense", "transfer", "ignore", "unclassified"]).default("unclassified").notNull(),
    categoryId: int("categoryId").references(() => cashFlowCategories.id),
    matchStatus: mysqlEnum("matchStatus", ["new", "exact_duplicate", "possible_duplicate", "invalid", "posted", "excluded"]).default("new").notNull(),
    matchedEventId: int("matchedEventId").references(() => financialEvents.id),
    postedEventId: int("postedEventId").references(() => financialEvents.id),
    reviewNote: text("reviewNote"),
    idempotencyKey: varchar("idempotencyKey", { length: 160 }).notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    importRowUnique: uniqueIndex("bank_row_import_number_unique").on(table.importId, table.sourceRowNumber),
    workspaceStatusIndex: index("bank_row_workspace_status_idx").on(table.workspaceId, table.matchStatus, table.occurredAt),
    importStatusIndex: index("bank_row_import_status_idx").on(table.importId, table.matchStatus),
    idempotencyUnique: uniqueIndex("bank_row_workspace_idempotency_unique").on(table.workspaceId, table.idempotencyKey),
  })
);

export const auditEvents = mysqlTable(
  "audit_events",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    actorUserId: int("actorUserId").notNull().references(() => users.id),
    action: varchar("action", { length: 120 }).notNull(),
    targetType: varchar("targetType", { length: 100 }).notNull(),
    targetId: varchar("targetId", { length: 100 }).notNull(),
    beforeState: json("beforeState"),
    afterState: json("afterState"),
    requestId: varchar("requestId", { length: 120 }).notNull(),
    occurredAt: bigint("occurredAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceOccurredIndex: index("audit_workspace_occurred_idx").on(table.workspaceId, table.occurredAt),
    targetIndex: index("audit_target_idx").on(table.targetType, table.targetId),
  })
);

export const approvalPolicies = mysqlTable("approval_policies", {
  id: int("id").autoincrement().primaryKey(), workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }), name: varchar("name", { length: 120 }).notNull(), actionType: mysqlEnum("actionType", ["cash_event", "transfer", "trade", "budget_adjustment", "period_adjustment"]).notNull(), currency: varchar("currency", { length: 3 }).notNull(), thresholdAmount: decimal("thresholdAmount", { precision: 20, scale: 6 }).notNull(), approverRole: mysqlEnum("approverRole", ["advisor", "owner"]).default("advisor").notNull(), requireSeparateApprover: mysqlEnum("requireSeparateApprover", ["yes", "no"]).default("yes").notNull(), requireReconfirmation: mysqlEnum("requireReconfirmation", ["yes", "no"]).default("yes").notNull(), status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(), createdByUserId: int("createdByUserId").notNull().references(() => users.id), createdAt: bigint("createdAt", { mode: "number" }).notNull(), updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
}, table => ({ workspaceActionIndex: index("approval_policy_workspace_action_idx").on(table.workspaceId, table.actionType, table.status) }));

export const approvalRequests = mysqlTable("approval_requests", {
  id: int("id").autoincrement().primaryKey(), workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }), policyId: int("policyId").references(() => approvalPolicies.id, { onDelete: "set null" }), requestedByUserId: int("requestedByUserId").notNull().references(() => users.id), actionType: mysqlEnum("actionType", ["cash_event", "transfer", "trade", "budget_adjustment", "period_adjustment"]).notNull(), actionPayload: json("actionPayload").notNull(), amount: decimal("amount", { precision: 20, scale: 6 }), currency: varchar("currency", { length: 3 }), status: mysqlEnum("status", ["pending", "approved", "rejected", "cancelled", "executed", "expired"]).default("pending").notNull(), requiredApproverRole: mysqlEnum("requiredApproverRole", ["advisor", "owner"]).notNull(), expiresAt: bigint("expiresAt", { mode: "number" }), executedEventId: int("executedEventId").references(() => financialEvents.id), createdAt: bigint("createdAt", { mode: "number" }).notNull(), updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
}, table => ({ workspaceStatusIndex: index("approval_request_workspace_status_idx").on(table.workspaceId, table.status, table.createdAt), requesterIndex: index("approval_request_requester_idx").on(table.requestedByUserId) }));

export const approvalDecisions = mysqlTable("approval_decisions", {
  id: int("id").autoincrement().primaryKey(), workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }), requestId: int("requestId").notNull().references(() => approvalRequests.id, { onDelete: "cascade" }), decidedByUserId: int("decidedByUserId").notNull().references(() => users.id), decision: mysqlEnum("decision", ["approved", "rejected"]).notNull(), note: text("note"), reconfirmedAt: bigint("reconfirmedAt", { mode: "number" }), createdAt: bigint("createdAt", { mode: "number" }).notNull(),
}, table => ({ requestDeciderUnique: uniqueIndex("approval_decision_request_user_unique").on(table.requestId, table.decidedByUserId), workspaceRequestIndex: index("approval_decision_workspace_request_idx").on(table.workspaceId, table.requestId) }));

export const financialPeriods = mysqlTable("financial_periods", {
  id: int("id").autoincrement().primaryKey(), workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }), periodKey: varchar("periodKey", { length: 7 }).notNull(), status: mysqlEnum("status", ["open", "closed"]).default("open").notNull(), closedByUserId: int("closedByUserId").references(() => users.id), closedAt: bigint("closedAt", { mode: "number" }), closeApprovalRequestId: int("closeApprovalRequestId").references(() => approvalRequests.id), createdAt: bigint("createdAt", { mode: "number" }).notNull(), updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
}, table => ({ workspacePeriodUnique: uniqueIndex("financial_period_workspace_period_unique").on(table.workspaceId, table.periodKey) }));

export const budgetTemplates = mysqlTable("budget_templates", {
  id: int("id").autoincrement().primaryKey(), workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }), name: varchar("name", { length: 140 }).notNull(), horizonMonths: mysqlEnum("horizonMonths", ["3", "6"]).notNull(), startsPeriodKey: varchar("startsPeriodKey", { length: 7 }).notNull(), spendingLimitBase: decimal("spendingLimitBase", { precision: 20, scale: 6 }), status: mysqlEnum("status", ["draft", "active", "archived"]).default("draft").notNull(), createdByUserId: int("createdByUserId").notNull().references(() => users.id), createdAt: bigint("createdAt", { mode: "number" }).notNull(), updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
}, table => ({ workspaceStatusIndex: index("budget_template_workspace_status_idx").on(table.workspaceId, table.status) }));

export const budgetTemplateLines = mysqlTable("budget_template_lines", {
  id: int("id").autoincrement().primaryKey(), workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }), templateId: int("templateId").notNull().references(() => budgetTemplates.id, { onDelete: "cascade" }), categoryId: int("categoryId").notNull().references(() => cashFlowCategories.id), plannedAmountBase: decimal("plannedAmountBase", { precision: 20, scale: 6 }).notNull(), createdAt: bigint("createdAt", { mode: "number" }).notNull(), updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
}, table => ({ templateCategoryUnique: uniqueIndex("budget_template_line_template_category_unique").on(table.templateId, table.categoryId) }));

export const planningScenarios = mysqlTable("planning_scenarios", {
  id: int("id").autoincrement().primaryKey(), workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }), profileId: int("profileId").notNull().references(() => financialProfiles.id), name: varchar("name", { length: 160 }).notNull(), scenarioType: mysqlEnum("scenarioType", ["debt", "retirement", "emergency", "cash_flow"]).notNull(), assumptions: json("assumptions").notNull(), result: json("result").notNull(), confidence: mysqlEnum("confidence", ["low", "medium", "high"]).default("low").notNull(), status: mysqlEnum("status", ["draft", "active", "archived"]).default("draft").notNull(), createdByUserId: int("createdByUserId").notNull().references(() => users.id), createdAt: bigint("createdAt", { mode: "number" }).notNull(), updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
}, table => ({ workspaceStatusIndex: index("scenario_workspace_status_idx").on(table.workspaceId, table.status, table.updatedAt) }));

export const personalIous = mysqlTable("personal_ious", {
  id: int("id").autoincrement().primaryKey(), workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }), profileId: int("profileId").notNull().references(() => financialProfiles.id), direction: mysqlEnum("direction", ["receivable", "payable"]).notNull(), counterpartyName: varchar("counterpartyName", { length: 200 }).notNull(), description: text("description"), amount: decimal("amount", { precision: 20, scale: 6 }).notNull(), currency: varchar("currency", { length: 3 }).notNull(), dueAt: bigint("dueAt", { mode: "number" }), settlementEventId: int("settlementEventId").references(() => financialEvents.id), status: mysqlEnum("status", ["active", "settled", "archived"]).default("active").notNull(), createdByUserId: int("createdByUserId").notNull().references(() => users.id), createdAt: bigint("createdAt", { mode: "number" }).notNull(), updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
}, table => ({ workspaceStatusIndex: index("personal_iou_workspace_status_idx").on(table.workspaceId, table.status, table.dueAt) }));

export const insuranceClaims = mysqlTable("insurance_claims", {
  id: int("id").autoincrement().primaryKey(), workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }), profileId: int("profileId").notNull().references(() => financialProfiles.id), policyId: int("policyId").notNull().references(() => insurancePolicies.id, { onDelete: "cascade" }), referenceNumber: varchar("referenceNumber", { length: 160 }), claimedAmount: decimal("claimedAmount", { precision: 20, scale: 6 }).notNull(), receivedAmount: decimal("receivedAmount", { precision: 20, scale: 6 }), currency: varchar("currency", { length: 3 }).notNull(), submittedAt: bigint("submittedAt", { mode: "number" }).notNull(), expectedAt: bigint("expectedAt", { mode: "number" }), receivedEventId: int("receivedEventId").references(() => financialEvents.id), status: mysqlEnum("status", ["submitted", "approved", "paid", "rejected", "closed"]).default("submitted").notNull(), note: text("note"), createdByUserId: int("createdByUserId").notNull().references(() => users.id), createdAt: bigint("createdAt", { mode: "number" }).notNull(), updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
}, table => ({ workspacePolicyStatusIndex: index("insurance_claim_workspace_policy_status_idx").on(table.workspaceId, table.policyId, table.status) }));

export const zakatAssessments = mysqlTable("zakat_assessments", {
  id: int("id").autoincrement().primaryKey(), workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }), profileId: int("profileId").notNull().references(() => financialProfiles.id), haulStartedAt: bigint("haulStartedAt", { mode: "number" }).notNull(), assessedAt: bigint("assessedAt", { mode: "number" }).notNull(), goldNisabGrams: decimal("goldNisabGrams", { precision: 12, scale: 4 }).notNull(), goldPricePerGramBase: decimal("goldPricePerGramBase", { precision: 20, scale: 6 }).notNull(), eligibleBase: decimal("eligibleBase", { precision: 20, scale: 6 }).notNull(), nisabBase: decimal("nisabBase", { precision: 20, scale: 6 }).notNull(), zakatDueBase: decimal("zakatDueBase", { precision: 20, scale: 6 }).notNull(), currency: varchar("currency", { length: 3 }).notNull(), methodology: json("methodology").notNull(), paymentEventId: int("paymentEventId").references(() => financialEvents.id), status: mysqlEnum("status", ["calculated", "paid", "archived"]).default("calculated").notNull(), createdByUserId: int("createdByUserId").notNull().references(() => users.id), createdAt: bigint("createdAt", { mode: "number" }).notNull(), updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
}, table => ({ workspaceStatusIndex: index("zakat_assessment_workspace_status_idx").on(table.workspaceId, table.status, table.assessedAt) }));

export const vaultDocuments = mysqlTable("vault_documents", {
  id: int("id").autoincrement().primaryKey(), workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }), profileId: int("profileId").notNull().references(() => financialProfiles.id), encryptedStorageKey: text("encryptedStorageKey").notNull(), encryptedOriginalName: text("encryptedOriginalName").notNull(), mimeType: varchar("mimeType", { length: 160 }).notNull(), byteSize: int("byteSize").notNull(), sha256: varchar("sha256", { length: 64 }).notNull(), linkedEntityType: varchar("linkedEntityType", { length: 80 }).notNull(), linkedEntityId: varchar("linkedEntityId", { length: 100 }).notNull(), createdByUserId: int("createdByUserId").notNull().references(() => users.id), createdAt: bigint("createdAt", { mode: "number" }).notNull(), updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
}, table => ({ workspaceLinkIndex: index("vault_document_workspace_link_idx").on(table.workspaceId, table.linkedEntityType, table.linkedEntityId), workspaceCreatedIndex: index("vault_document_workspace_created_idx").on(table.workspaceId, table.createdAt) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type FinancialProfile = typeof financialProfiles.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type FinancialEvent = typeof financialEvents.$inferSelect;
export type JournalLine = typeof journalLines.$inferSelect;


export const investmentLots = mysqlTable(
  "investment_lots",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    accountId: int("accountId").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    instrumentId: int("instrumentId").notNull().references(() => instruments.id),
    acquisitionEventId: int("acquisitionEventId").notNull().references(() => financialEvents.id),
    sourceLotId: int("sourceLotId"),
    acquiredAt: bigint("acquiredAt", { mode: "number" }).notNull(),
    originalQuantity: decimal("originalQuantity", { precision: 24, scale: 8 }).notNull(),
    remainingQuantity: decimal("remainingQuantity", { precision: 24, scale: 8 }).notNull(),
    unitCost: decimal("unitCost", { precision: 24, scale: 8 }).notNull(),
    totalCost: decimal("totalCost", { precision: 24, scale: 8 }).notNull(),
    costCurrency: varchar("costCurrency", { length: 3 }).notNull(),
    feeAmount: decimal("feeAmount", { precision: 24, scale: 8 }).default("0").notNull(),
    taxAmount: decimal("taxAmount", { precision: 24, scale: 8 }).default("0").notNull(),
    status: mysqlEnum("status", ["open", "closed"]).default("open").notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceInstrumentIndex: index("lots_workspace_instrument_idx").on(table.workspaceId, table.instrumentId),
    fifoIndex: index("lots_fifo_idx").on(table.workspaceId, table.accountId, table.instrumentId, table.acquiredAt, table.id),
    sourceLotIndex: index("lots_source_lot_idx").on(table.workspaceId, table.sourceLotId),
  })
);

export const lotTransfers = mysqlTable(
  "lot_transfers",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    transferEventId: int("transferEventId").notNull().references(() => financialEvents.id, { onDelete: "cascade" }),
    sourceLotId: int("sourceLotId").notNull().references(() => investmentLots.id, { onDelete: "cascade" }),
    destinationLotId: int("destinationLotId").notNull().references(() => investmentLots.id, { onDelete: "cascade" }),
    quantity: decimal("quantity", { precision: 24, scale: 8 }).notNull(),
    costBasis: decimal("costBasis", { precision: 24, scale: 8 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  },
  table => ({
    transferEventIndex: index("lot_transfers_event_idx").on(table.workspaceId, table.transferEventId),
    sourceLotIndex: index("lot_transfers_source_idx").on(table.workspaceId, table.sourceLotId),
    destinationLotIndex: index("lot_transfers_destination_idx").on(table.workspaceId, table.destinationLotId),
  })
);

export const corporateActions = mysqlTable(
  "corporate_actions",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    instrumentId: int("instrumentId").notNull().references(() => instruments.id),
    financialEventId: int("financialEventId").notNull().references(() => financialEvents.id, { onDelete: "cascade" }),
    actionType: mysqlEnum("actionType", ["stock_split"]).notNull(),
    ratio: decimal("ratio", { precision: 24, scale: 8 }).notNull(),
    effectiveAt: bigint("effectiveAt", { mode: "number" }).notNull(),
    source: mysqlEnum("source", ["manual", "imported", "api"]).default("manual").notNull(),
    memo: text("memo"),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  },
  table => ({
    eventUnique: uniqueIndex("corporate_actions_event_unique").on(table.financialEventId),
    workspaceInstrumentIndex: index("corporate_actions_workspace_instrument_idx").on(table.workspaceId, table.instrumentId, table.effectiveAt),
  })
);

export const lotMatches = mysqlTable(
  "lot_matches",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    sellEventId: int("sellEventId").notNull().references(() => financialEvents.id, { onDelete: "cascade" }),
    lotId: int("lotId").notNull().references(() => investmentLots.id, { onDelete: "cascade" }),
    quantity: decimal("quantity", { precision: 24, scale: 8 }).notNull(),
    costBasis: decimal("costBasis", { precision: 24, scale: 8 }).notNull(),
    grossProceeds: decimal("grossProceeds", { precision: 24, scale: 8 }).notNull(),
    allocatedFee: decimal("allocatedFee", { precision: 24, scale: 8 }).default("0").notNull(),
    allocatedTax: decimal("allocatedTax", { precision: 24, scale: 8 }).default("0").notNull(),
    realizedPnl: decimal("realizedPnl", { precision: 24, scale: 8 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    matchedAt: bigint("matchedAt", { mode: "number" }).notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceSellIndex: index("lot_matches_workspace_sell_idx").on(table.workspaceId, table.sellEventId),
    lotIndex: index("lot_matches_lot_idx").on(table.workspaceId, table.lotId),
  })
);

export const marketCandles = mysqlTable(
  "market_candles",
  {
    id: int("id").autoincrement().primaryKey(),
    instrumentId: int("instrumentId").notNull().references(() => instruments.id, { onDelete: "cascade" }),
    timeframe: mysqlEnum("timeframe", ["1h", "4h", "1d", "1w"]).default("1d").notNull(),
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
    open: decimal("open", { precision: 14, scale: 4 }).notNull(),
    high: decimal("high", { precision: 14, scale: 4 }).notNull(),
    low: decimal("low", { precision: 14, scale: 4 }).notNull(),
    close: decimal("close", { precision: 14, scale: 4 }).notNull(),
    volume: decimal("volume", { precision: 18, scale: 2 }).notNull(),
  },
  table => ({
    instrumentTimeframeTimestampIndex: index("market_candles_instrument_tf_ts_idx").on(
      table.instrumentId,
      table.timeframe,
      table.timestamp
    ),
  })
);

export const swingTrades = mysqlTable(
  "swing_trades",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    instrumentId: int("instrumentId").notNull().references(() => instruments.id),
    assetCategory: mysqlEnum("assetCategory", ["EGX_STOCK", "NBE_MUTUAL_FUND", "TELDA_LIQUIDITY", "GOLD", "CRYPTO_OTHER"]).default("EGX_STOCK").notNull(),
    fundingAccountId: int("fundingAccountId").references(() => accounts.id, { onDelete: "set null" }),
    isPaperTrading: boolean("isPaperTrading").default(false).notNull(),
    direction: mysqlEnum("direction", ["LONG", "SHORT"]).default("LONG").notNull(),
    quantity: decimal("quantity", { precision: 14, scale: 4 }).notNull(),
    entryPrice: decimal("entryPrice", { precision: 14, scale: 4 }).notNull(),
    stopLossPrice: decimal("stopLossPrice", { precision: 14, scale: 4 }),
    takeProfitPrice: decimal("takeProfitPrice", { precision: 14, scale: 4 }),
    entryDate: bigint("entryDate", { mode: "number" }).notNull(),
    exitDeadline: bigint("exitDeadline", { mode: "number" }),
    targetHoldingDays: int("targetHoldingDays").default(10),
    status: mysqlEnum("status", ["OPEN", "TARGET_HIT", "STOPPED_OUT", "TIME_EXPIRED", "CLOSED_MANUALLY", "CANCELLED"]).default("OPEN").notNull(),
    exitPrice: decimal("exitPrice", { precision: 14, scale: 4 }),
    exitDate: bigint("exitDate", { mode: "number" }),
    strategyTag: varchar("strategyTag", { length: 100 }),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    workspaceStatusIndex: index("swing_trades_workspace_status_idx").on(table.workspaceId, table.status),
    workspaceInstrumentIndex: index("swing_trades_workspace_instrument_idx").on(table.workspaceId, table.instrumentId),
  })
);

export type MarketCandle = typeof marketCandles.$inferSelect;
export type InsertMarketCandle = typeof marketCandles.$inferInsert;
export type SwingTrade = typeof swingTrades.$inferSelect;
export type InsertSwingTrade = typeof swingTrades.$inferInsert;

export const bankCertificates = mysqlTable(
  "bank_certificates",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    profileId: int("profileId").notNull().references(() => financialProfiles.id),
    certificateName: varchar("certificateName", { length: 160 }).notNull(),
    bankName: varchar("bankName", { length: 160 }).notNull(),
    principalAmount: decimal("principalAmount", { precision: 20, scale: 6 }).notNull(),
    interestRate: decimal("interestRate", { precision: 12, scale: 6 }).notNull(),
    payoutFrequency: mysqlEnum("payoutFrequency", ["monthly", "quarterly", "semi_annual", "annual"]).default("monthly").notNull(),
    issueDate: bigint("issueDate", { mode: "number" }).notNull(),
    maturityDate: bigint("maturityDate", { mode: "number" }).notNull(),
    linkedPayoutAccountId: int("linkedPayoutAccountId").references(() => accounts.id),
    currency: varchar("currency", { length: 3 }).default("EGP").notNull(),
    status: mysqlEnum("status", ["active", "matured", "redeemed"]).default("active").notNull(),
    lastYieldCollectedAt: bigint("lastYieldCollectedAt", { mode: "number" }),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceStatusIndex: index("bank_certificates_workspace_status_idx").on(table.workspaceId, table.status),
    workspaceIndex: index("bank_certificates_workspace_idx").on(table.workspaceId),
  })
);

export const creditCardInstallments = mysqlTable(
  "credit_card_installments",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    debtId: int("debtId").notNull().references(() => debts.id, { onDelete: "cascade" }),
    merchantName: varchar("merchantName", { length: 160 }).notNull(),
    planName: varchar("planName", { length: 160 }).notNull(),
    totalAmount: decimal("totalAmount", { precision: 20, scale: 6 }).notNull(),
    monthlyAmount: decimal("monthlyAmount", { precision: 20, scale: 6 }).notNull(),
    tenureMonths: int("tenureMonths").notNull(),
    remainingMonths: int("remainingMonths").notNull(),
    startDate: bigint("startDate", { mode: "number" }).notNull(),
    status: mysqlEnum("status", ["active", "completed", "cancelled"]).default("active").notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    workspaceDebtIndex: index("cc_installments_workspace_debt_idx").on(table.workspaceId, table.debtId, table.status),
  })
);

export type BankCertificate = typeof bankCertificates.$inferSelect;
export type InsertBankCertificate = typeof bankCertificates.$inferInsert;
export type CreditCardInstallment = typeof creditCardInstallments.$inferSelect;
export type InsertCreditCardInstallment = typeof creditCardInstallments.$inferInsert;
