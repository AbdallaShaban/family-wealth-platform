/**
 * Phase 1 domain contracts.
 *
 * These declarations are intentionally descriptive: they document the allowed
 * boundaries between financial truth, derived projections, and external data.
 * They do not create ledger entries or alter runtime financial behavior.
 */

export const FINANCIAL_DATA_CLASSES = [
  "ledger_fact",
  "derived_projection",
  "external_market_data",
  "valuation_snapshot",
  "operational_metadata",
] as const;

export type FinancialDataClass = (typeof FINANCIAL_DATA_CLASSES)[number];

export const LEDGER_TRUTH_CLASSES = ["ledger_fact"] as const satisfies readonly FinancialDataClass[];
export const NON_LEDGER_WRITE_CLASSES = [
  "derived_projection",
  "external_market_data",
  "valuation_snapshot",
  "operational_metadata",
] as const satisfies readonly FinancialDataClass[];

export const FAMILY_CAPABILITIES = [
  "view_workspace",
  "view_sensitive_values",
  "create_draft",
  "edit_draft",
  "post_ledger",
  "reverse_posted",
  "approve_financial_action",
  "manage_members",
  "manage_policies",
  "manage_market_preferences",
  "view_audit",
  "export_workspace",
  "view_vault",
] as const;

export type FamilyCapability = (typeof FAMILY_CAPABILITIES)[number];
export type WorkspaceRole = "owner" | "advisor" | "editor" | "viewer";

export const WORKSPACE_ROLE_CAPABILITIES: Readonly<Record<WorkspaceRole, readonly FamilyCapability[]>> = {
  owner: [
    "view_workspace",
    "view_sensitive_values",
    "create_draft",
    "edit_draft",
    "post_ledger",
    "reverse_posted",
    "approve_financial_action",
    "manage_members",
    "manage_policies",
    "manage_market_preferences",
    "view_audit",
    "export_workspace",
    "view_vault",
  ],
  advisor: [
    "view_workspace",
    "view_sensitive_values",
    "create_draft",
    "edit_draft",
    "approve_financial_action",
    "manage_market_preferences",
    "view_audit",
    "export_workspace",
    "view_vault",
  ],
  editor: [
    "view_workspace",
    "view_sensitive_values",
    "create_draft",
    "edit_draft",
    "manage_market_preferences",
  ],
  viewer: ["view_workspace", "manage_market_preferences"],
};

export const NON_LEDGER_PRODUCERS = [
  "market_refresh",
  "market_signal",
  "scenario_projection",
  "ai_advisor",
  "notification_delivery",
] as const;

export type NonLedgerProducer = (typeof NON_LEDGER_PRODUCERS)[number];

export function roleHasCapability(role: WorkspaceRole, capability: FamilyCapability) {
  return WORKSPACE_ROLE_CAPABILITIES[role].includes(capability);
}

export function canProducerWriteLedger(producer: NonLedgerProducer) {
  void producer;
  return false;
}

export function isLedgerTruth(dataClass: FinancialDataClass) {
  return dataClass === "ledger_fact";
}

export function isNonLedger(dataClass: FinancialDataClass) {
  return NON_LEDGER_WRITE_CLASSES.includes(dataClass as (typeof NON_LEDGER_WRITE_CLASSES)[number]);
}
