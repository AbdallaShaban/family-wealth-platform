import { and, eq, inArray, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  accounts,
  allocationTargets,
  approvalDecisions,
  approvalPolicies,
  approvalRequests,
  auditEvents,
  bankStatementImports,
  bankStatementRows,
  budgets,
  budgetTemplateLines,
  budgetTemplates,
  cashFlowCategories,
  corporateActions,
  debtPayments,
  debts,
  emergencyFundPlans,
  feeTaxRules,
  financialEvents,
  financialGoals,
  financialPeriods,
  financialProfiles,
  fxRates,
  insuranceClaims,
  insurancePolicies,
  insurancePremiumPayments,
  instruments,
  investmentLots,
  journalEntries,
  journalLines,
  lotMatches,
  lotTransfers,
  marketEmailDeliveries,
  marketEmailPreferences,
  memberships,
  officialValuationSnapshots,
  personalIous,
  planningScenarios,
  positions,
  priceQuotes,
  recurringRules,
  researchNotes,
  retirementPlans,
  riskProfiles,
  specialAssets,
  specialAssetValuations,
  valuationProvenance,
  valuationSnapshots,
  vaultDocuments,
  watchlistItems,
  workspaceInvitations,
  workspaces,
  zakatAssessments,
} from "../drizzle/schema";

/**
 * Authoritative ordered list of all exactly 51 workspace-owned tables.
 * Level 0 down to Level 4 reflects foreign-key dependency order for insertion.
 * Deletion order is exactly the reverse.
 */
export const WORKSPACE_TABLE_DEFINITIONS = [
  // Level 0: Root workspace children (only reference workspace or users)
  { name: "financial_profiles", table: financialProfiles },
  { name: "memberships", table: memberships },
  { name: "workspace_invitations", table: workspaceInvitations },
  { name: "instruments", table: instruments },
  { name: "cash_flow_categories", table: cashFlowCategories },
  { name: "approval_policies", table: approvalPolicies },
  { name: "financial_periods", table: financialPeriods },
  { name: "risk_profiles", table: riskProfiles },
  { name: "allocation_targets", table: allocationTargets },
  { name: "watchlist_items", table: watchlistItems },
  { name: "market_email_preferences", table: marketEmailPreferences },
  { name: "research_notes", table: researchNotes },
  { name: "fee_tax_rules", table: feeTaxRules },
  { name: "special_assets", table: specialAssets },
  { name: "budget_templates", table: budgetTemplates },
  { name: "planning_scenarios", table: planningScenarios },
  { name: "fx_rates", table: fxRates },
  { name: "valuation_provenance", table: valuationProvenance },

  // Level 1: Reference Level 0
  { name: "accounts", table: accounts },
  { name: "price_quotes", table: priceQuotes },
  { name: "special_asset_valuations", table: specialAssetValuations },
  { name: "insurance_policies", table: insurancePolicies },
  { name: "debts", table: debts },
  { name: "emergency_fund_plans", table: emergencyFundPlans },
  { name: "financial_goals", table: financialGoals },
  { name: "retirement_plans", table: retirementPlans },
  { name: "budget_template_lines", table: budgetTemplateLines },
  { name: "budgets", table: budgets },
  { name: "recurring_rules", table: recurringRules },
  { name: "bank_statement_imports", table: bankStatementImports },

  // Level 2: Reference Level 1
  { name: "valuation_snapshots", table: valuationSnapshots },
  { name: "official_valuation_snapshots", table: officialValuationSnapshots },
  { name: "financial_events", table: financialEvents },
  { name: "debt_payments", table: debtPayments },
  { name: "insurance_premium_payments", table: insurancePremiumPayments },
  { name: "insurance_claims", table: insuranceClaims },
  { name: "personal_ious", table: personalIous },
  { name: "zakat_assessments", table: zakatAssessments },
  { name: "vault_documents", table: vaultDocuments },
  { name: "bank_statement_rows", table: bankStatementRows },
  { name: "approval_requests", table: approvalRequests },

  // Level 3: Reference Level 2
  { name: "journal_entries", table: journalEntries },
  { name: "positions", table: positions },
  { name: "investment_lots", table: investmentLots },
  { name: "approval_decisions", table: approvalDecisions },
  { name: "market_email_deliveries", table: marketEmailDeliveries },

  // Level 4: Reference Level 3
  { name: "journal_lines", table: journalLines },
  { name: "lot_transfers", table: lotTransfers },
  { name: "corporate_actions", table: corporateActions },
  { name: "lot_matches", table: lotMatches },
  { name: "audit_events", table: auditEvents },
] as const;

export const WORKSPACE_TABLE_NAMES = WORKSPACE_TABLE_DEFINITIONS.map(def => def.name);

export type FullWorkspaceBackupEnvelope = {
  format: "family-full-backup-v1";
  version: "1.0";
  workspaceId: number;
  workspaceMetadata: {
    name: string;
    baseCurrency: string;
    exportedAt: number;
    tableCount: number;
  };
  manifest: {
    tables: Record<string, number>;
    totalRows: number;
    payloadSha256: string;
  };
  payload: Record<string, Record<string, unknown>[]>;
};

export type BackupValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  tableCounts: Record<string, number>;
  totalRows: number;
};

/**
 * Computes deterministic SHA-256 hash over payload string.
 */
export function computePayloadSha256(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash("sha256").update(json, "utf8").digest("hex");
}

/**
 * Exports a full relational backup of all 51 workspace-owned tables.
 */
export async function exportFullWorkspaceBackup(workspaceId: number): Promise<FullWorkspaceBackupEnvelope> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة بيانات FAMILY غير متاحة." });

  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  if (!workspace) throw new TRPCError({ code: "NOT_FOUND", message: "مساحة العمل غير موجودة." });

  const payload: Record<string, Record<string, unknown>[]> = {};
  const tableCounts: Record<string, number> = {};
  let totalRows = 0;

  for (const { name, table } of WORKSPACE_TABLE_DEFINITIONS) {
    const rows = (await db.select().from(table as any).where(eq((table as any).workspaceId, workspaceId))) as Record<string, unknown>[];
    payload[name] = rows;
    tableCounts[name] = rows.length;
    totalRows += rows.length;
  }

  const payloadSha256 = computePayloadSha256(payload);
  const exportedAt = Date.now();

  return {
    format: "family-full-backup-v1",
    version: "1.0",
    workspaceId,
    workspaceMetadata: {
      name: workspace.name,
      baseCurrency: workspace.baseCurrency,
      exportedAt,
      tableCount: WORKSPACE_TABLE_DEFINITIONS.length,
    },
    manifest: {
      tables: tableCounts,
      totalRows,
      payloadSha256,
    },
    payload,
  };
}

/**
 * Validates a backup envelope before any restore attempt.
 */
export function validateWorkspaceBackup(envelope: unknown): BackupValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tableCounts: Record<string, number> = {};
  let totalRows = 0;

  if (!envelope || typeof envelope !== "object") {
    return { valid: false, errors: ["ملف النسخة الاحتياطية غير صالح (ليس كائن JSON)."], warnings, tableCounts, totalRows: 0 };
  }

  const backup = envelope as Partial<FullWorkspaceBackupEnvelope>;

  if (backup.format !== "family-full-backup-v1") {
    errors.push(`تنسيق النسخة الاحتياطية غير مدعوم: ${backup.format || "مفقود"}`);
  }

  if (!backup.workspaceMetadata || !backup.workspaceMetadata.name || !backup.workspaceMetadata.baseCurrency) {
    errors.push("البيانات الوصفية لمساحة العمل مفقودة أو غير مكتملة.");
  }

  if (!backup.manifest || typeof backup.manifest.payloadSha256 !== "string") {
    errors.push("بيان سلامة النسخة (Manifest) مفقود.");
  }

  if (!backup.payload || typeof backup.payload !== "object") {
    errors.push("حزمة البيانات المالية (Payload) مفقودة.");
    return { valid: false, errors, warnings, tableCounts, totalRows: 0 };
  }

  // Check expected tables presence
  for (const tableName of WORKSPACE_TABLE_NAMES) {
    const rows = backup.payload[tableName];
    if (!Array.isArray(rows)) {
      errors.push(`الجدول المالي المطلوب مفقود من الحزمة: ${tableName}`);
      tableCounts[tableName] = 0;
    } else {
      tableCounts[tableName] = rows.length;
      totalRows += rows.length;
    }
  }

  // Verify SHA-256 hash match
  if (backup.manifest?.payloadSha256) {
    const computedSha256 = computePayloadSha256(backup.payload);
    if (computedSha256 !== backup.manifest.payloadSha256) {
      errors.push("فشل التحقق من البصمة الرقمية (SHA-256 Checksum Mismatch): البيانات تالفة أو تم تعديلها.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    tableCounts,
    totalRows,
  };
}

/**
 * Restores or Clones a full workspace backup inside an atomic transaction.
 * Handles foreign-key remapping so child references are preserved without collisions.
 */
export async function restoreFullWorkspaceBackup(args: {
  backup: FullWorkspaceBackupEnvelope;
  targetWorkspaceId?: number;
  actorUserId: number;
  mode: "overwrite" | "clone";
  newWorkspaceName?: string;
}): Promise<{
  success: boolean;
  workspaceId: number;
  workspaceName: string;
  totalRestoredRows: number;
  tableCounts: Record<string, number>;
}> {
  const validation = validateWorkspaceBackup(args.backup);
  if (!validation.valid) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `فشل فحص سلامة النسخة الاحتياطية: ${validation.errors.join("; ")}`,
    });
  }

  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة بيانات FAMILY غير متاحة." });

  return db.transaction(async tx => {
    let effectiveWorkspaceId: number;
    let effectiveWorkspaceName: string;
    const now = Date.now();

    if (args.mode === "clone") {
      // 1. Create a brand new workspace
      effectiveWorkspaceName = args.newWorkspaceName?.trim() || `${args.backup.workspaceMetadata.name} (نسخة مستعادة)`;
      const [newWs] = await tx.insert(workspaces).values({
        name: effectiveWorkspaceName,
        baseCurrency: args.backup.workspaceMetadata.baseCurrency,
        createdByUserId: args.actorUserId,
        createdAt: now,
        updatedAt: now,
      });
      effectiveWorkspaceId = Number(newWs.insertId);

      // Ensure actor has owner membership in the cloned workspace
      await tx.insert(memberships).values({
        workspaceId: effectiveWorkspaceId,
        userId: args.actorUserId,
        role: "owner",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    } else {
      // 2. Overwrite mode into targetWorkspaceId
      if (!args.targetWorkspaceId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "يجب تحديد مساحة عمل صالحة لوضع الاستعادة بالاستبدال." });
      }
      effectiveWorkspaceId = args.targetWorkspaceId;

      const [existingWs] = await tx.select().from(workspaces).where(eq(workspaces.id, effectiveWorkspaceId)).limit(1);
      if (!existingWs) throw new TRPCError({ code: "NOT_FOUND", message: "مساحة العمل المطلوبة للاستعادة غير موجودة." });
      effectiveWorkspaceName = existingWs.name;

      // Delete all existing 51 tables in reverse dependency order
      const reverseDefs = [...WORKSPACE_TABLE_DEFINITIONS].reverse();
      for (const { table } of reverseDefs) {
        await tx.delete(table as any).where(eq((table as any).workspaceId, effectiveWorkspaceId));
      }
    }

    // 3. ID Remapping maps
    const idMaps: Record<string, Map<number, number>> = {
      financial_profiles: new Map(),
      accounts: new Map(),
      instruments: new Map(),
      cash_flow_categories: new Map(),
      approval_policies: new Map(),
      financial_periods: new Map(),
      risk_profiles: new Map(),
      budget_templates: new Map(),
      planning_scenarios: new Map(),
      special_assets: new Map(),
      insurance_policies: new Map(),
      debts: new Map(),
      emergency_fund_plans: new Map(),
      price_quotes: new Map(),
      valuation_provenance: new Map(),
      valuation_snapshots: new Map(),
      financial_events: new Map(),
      journal_entries: new Map(),
      investment_lots: new Map(),
      approval_requests: new Map(),
      bank_statement_imports: new Map(),
    };

    const restoredCounts: Record<string, number> = {};
    let totalRestoredRows = 0;

    // 4. Insert each of the 51 tables in forward dependency order
    for (const { name, table } of WORKSPACE_TABLE_DEFINITIONS) {
      const rows = args.backup.payload[name] || [];
      restoredCounts[name] = 0;

      for (const originalRow of rows) {
        const row = { ...originalRow };
        const oldId = typeof row.id === "number" ? row.id : null;
        delete (row as any).id; // Let auto-increment assign clean IDs

        // Always rebind to target workspace
        (row as any).workspaceId = effectiveWorkspaceId;

        // Apply FK remappings based on table relationships
        if (name === "accounts") {
          if (row.ownerProfileId && idMaps.financial_profiles.has(row.ownerProfileId as number)) {
            row.ownerProfileId = idMaps.financial_profiles.get(row.ownerProfileId as number);
          }
        } else if (name === "financial_events") {
          if (row.profileId && idMaps.financial_profiles.has(row.profileId as number)) {
            row.profileId = idMaps.financial_profiles.get(row.profileId as number)!;
          }
          if (row.primaryAccountId && idMaps.accounts.has(row.primaryAccountId as number)) {
            row.primaryAccountId = idMaps.accounts.get(row.primaryAccountId as number);
          }
          if (row.counterAccountId && idMaps.accounts.has(row.counterAccountId as number)) {
            row.counterAccountId = idMaps.accounts.get(row.counterAccountId as number);
          }
          if (row.instrumentId && idMaps.instruments.has(row.instrumentId as number)) {
            row.instrumentId = idMaps.instruments.get(row.instrumentId as number);
          }
          if (row.categoryId && idMaps.cash_flow_categories.has(row.categoryId as number)) {
            row.categoryId = idMaps.cash_flow_categories.get(row.categoryId as number);
          }
        } else if (name === "journal_entries") {
          if (row.financialEventId && idMaps.financial_events.has(row.financialEventId as number)) {
            row.financialEventId = idMaps.financial_events.get(row.financialEventId as number);
          }
        } else if (name === "journal_lines") {
          if (row.entryId && idMaps.journal_entries.has(row.entryId as number)) {
            row.entryId = idMaps.journal_entries.get(row.entryId as number);
          }
          if (row.accountId && idMaps.accounts.has(row.accountId as number)) {
            row.accountId = idMaps.accounts.get(row.accountId as number);
          }
        } else if (name === "positions") {
          if (row.accountId && idMaps.accounts.has(row.accountId as number)) {
            row.accountId = idMaps.accounts.get(row.accountId as number);
          }
          if (row.instrumentId && idMaps.instruments.has(row.instrumentId as number)) {
            row.instrumentId = idMaps.instruments.get(row.instrumentId as number);
          }
        } else if (name === "investment_lots") {
          if (row.accountId && idMaps.accounts.has(row.accountId as number)) {
            row.accountId = idMaps.accounts.get(row.accountId as number);
          }
          if (row.instrumentId && idMaps.instruments.has(row.instrumentId as number)) {
            row.instrumentId = idMaps.instruments.get(row.instrumentId as number);
          }
          if (row.acquisitionEventId && idMaps.financial_events.has(row.acquisitionEventId as number)) {
            row.acquisitionEventId = idMaps.financial_events.get(row.acquisitionEventId as number);
          }
          if (row.sourceLotId && idMaps.investment_lots.has(row.sourceLotId as number)) {
            row.sourceLotId = idMaps.investment_lots.get(row.sourceLotId as number);
          }
        } else if (name === "lot_matches") {
          if (row.lotId && idMaps.investment_lots.has(row.lotId as number)) {
            row.lotId = idMaps.investment_lots.get(row.lotId as number);
          }
          if (row.sellEventId && idMaps.financial_events.has(row.sellEventId as number)) {
            row.sellEventId = idMaps.financial_events.get(row.sellEventId as number);
          }
        } else if (name === "corporate_actions") {
          if (row.instrumentId && idMaps.instruments.has(row.instrumentId as number)) {
            row.instrumentId = idMaps.instruments.get(row.instrumentId as number);
          }
          if (row.financialEventId && idMaps.financial_events.has(row.financialEventId as number)) {
            row.financialEventId = idMaps.financial_events.get(row.financialEventId as number);
          }
        } else if (name === "price_quotes") {
          if (row.instrumentId && idMaps.instruments.has(row.instrumentId as number)) {
            row.instrumentId = idMaps.instruments.get(row.instrumentId as number);
          }
        } else if (name === "valuation_snapshots") {
          if (row.instrumentId && idMaps.instruments.has(row.instrumentId as number)) {
            row.instrumentId = idMaps.instruments.get(row.instrumentId as number);
          }
          if (row.provenanceId && idMaps.valuation_provenance.has(row.provenanceId as number)) {
            row.provenanceId = idMaps.valuation_provenance.get(row.provenanceId as number);
          }
          if (row.quoteId && idMaps.price_quotes.has(row.quoteId as number)) {
            row.quoteId = idMaps.price_quotes.get(row.quoteId as number);
          }
        } else if (name === "debts") {
          if (row.profileId && idMaps.financial_profiles.has(row.profileId as number)) {
            row.profileId = idMaps.financial_profiles.get(row.profileId as number)!;
          }
        } else if (name === "debt_payments") {
          if (row.debtId && idMaps.debts.has(row.debtId as number)) {
            row.debtId = idMaps.debts.get(row.debtId as number)!;
          }
        } else if (name === "insurance_policies") {
          if (row.profileId && idMaps.financial_profiles.has(row.profileId as number)) {
            row.profileId = idMaps.financial_profiles.get(row.profileId as number)!;
          }
        } else if (name === "insurance_claims" || name === "insurance_premium_payments") {
          if (row.policyId && idMaps.insurance_policies.has(row.policyId as number)) {
            row.policyId = idMaps.insurance_policies.get(row.policyId as number)!;
          }
        } else if (name === "personal_ious" || name === "zakat_assessments") {
          if (row.profileId && idMaps.financial_profiles.has(row.profileId as number)) {
            row.profileId = idMaps.financial_profiles.get(row.profileId as number)!;
          }
        } else if (name === "approval_requests") {
          if (row.policyId && idMaps.approval_policies.has(row.policyId as number)) {
            row.policyId = idMaps.approval_policies.get(row.policyId as number)!;
          }
        } else if (name === "approval_decisions") {
          if (row.requestId && idMaps.approval_requests.has(row.requestId as number)) {
            row.requestId = idMaps.approval_requests.get(row.requestId as number)!;
          }
        } else if (name === "bank_statement_rows") {
          if (row.importId && idMaps.bank_statement_imports.has(row.importId as number)) {
            row.importId = idMaps.bank_statement_imports.get(row.importId as number)!;
          }
        }

        // Avoid duplicate membership creation if clone mode already created one
        if (name === "memberships" && args.mode === "clone" && row.userId === args.actorUserId) {
          continue;
        }

        const insertResult = await tx.insert(table as any).values(row);
        const newId = Number((insertResult as any)[0]?.insertId || 0);

        if (oldId && newId && idMaps[name]) {
          idMaps[name].set(oldId, newId);
        }

        restoredCounts[name] += 1;
        totalRestoredRows += 1;
      }
    }

    // Record an immutable audit log entry for the restore action
    await tx.insert(auditEvents).values({
      workspaceId: effectiveWorkspaceId,
      actorUserId: args.actorUserId,
      action: args.mode === "clone" ? "workspace.cloned_from_backup" : "workspace.restored_from_backup",
      targetType: "workspace",
      targetId: String(effectiveWorkspaceId),
      beforeState: null,
      afterState: {
        sourceWorkspaceId: args.backup.workspaceId,
        sourceWorkspaceName: args.backup.workspaceMetadata.name,
        mode: args.mode,
        totalRestoredRows,
        manifestSha256: args.backup.manifest.payloadSha256,
      },
      requestId: crypto.randomUUID(),
      occurredAt: now,
    });

    return {
      success: true,
      workspaceId: effectiveWorkspaceId,
      workspaceName: effectiveWorkspaceName,
      totalRestoredRows,
      tableCounts: restoredCounts,
    };
  });
}
