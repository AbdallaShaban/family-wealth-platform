import { createHash } from "node:crypto";
import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import Decimal from "decimal.js";
import { getDb } from "./db";
import type { FamilyContext } from "./familyAccess";
import {
  accounts,
  auditEvents,
  financialEvents,
  fxRates,
  journalEntries,
  journalLines,
  officialValuationSnapshots,
  positions,
  priceQuotes,
  vaultDocuments,
} from "../drizzle/schema";
import { generateFinancialStatementsPackage } from "./financialStatementsRouter";
import { buildReconciliationReport, type ReconciliationEntry, type ReconciliationEvent, type ReconciliationFxRate, type ReconciliationLine, type ReconciliationPosition } from "./reconciliation";
import { encryptVaultValue, decryptVaultValue } from "./vaultCrypto";
import { storageGetSignedUrl, storagePut } from "./storage";
import { invalidateReadModelCache } from "./readModelCache";

export type FrozenAuditDossier = {
  metadata: {
    dossierVersion: "v1.0";
    periodKey: string;
    workspaceId: number;
    workspaceName: string;
    baseCurrency: string;
    closedAt: number;
    closedByUserId: number;
    closeApprovalRequestId?: number | null;
    epistemology: "AUTHORITATIVE_FACT";
  };
  financialStatements: {
    balanceSheet: any;
    incomeStatement: any;
    cashFlow: any;
    equityChanges: any;
    economicBridge: any;
    reconciliationAudit: any;
  };
  reconciliationCertificate: {
    status: "healthy" | "attention";
    unbalancedEntriesCount: number;
    orphanLinesCount: number;
    notes: string[];
    certifiedAt: number;
  };
  valuationMetadata: {
    officialSnapshotId: number | null;
    capturedAt: number | null;
  };
  fingerprint: {
    algorithm: "SHA-256";
    sha256: string;
  };
};

export type ArchivePeriodArgs = {
  context: FamilyContext;
  actorUserId: number;
  periodKey: string;
  closeApprovalRequestId?: number | null;
};

export function computePeriodDateRange(periodKey: string): { startDate: string; endDate: string; asOf: string } {
  const parts = periodKey.trim().split("-");
  if (parts.length !== 2) throw new Error("صيغة مفتاح الفترة المالية غير صالحة (YYYY-MM).");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    throw new Error("تاريخ الفترة المالية غير صالح.");
  }

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    asOf: end.toISOString().slice(0, 10),
  };
}

export function computeDossierFingerprint(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export async function archivePeriodClosureDossier(args: ArchivePeriodArgs) {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة بيانات FAMILY غير متاحة." });
  }

  const workspaceId = args.context.workspace.id;
  const profileId = args.context.profile.id;
  const periodKey = args.periodKey.trim();

  // 1. Idempotency Check: Prevent duplicate archives for the same closed period
  const [existing] = await db
    .select()
    .from(vaultDocuments)
    .where(
      and(
        eq(vaultDocuments.workspaceId, workspaceId),
        eq(vaultDocuments.linkedEntityType, "financial_period"),
        eq(vaultDocuments.linkedEntityId, periodKey)
      )
    )
    .limit(1);

  if (existing) {
    return {
      archived: false,
      duplicate: true,
      documentId: existing.id,
      sha256: existing.sha256,
      periodKey,
    };
  }

  const range = computePeriodDateRange(periodKey);

  // 2. Generate Authoritative Frozen Financial Statements Package
  const statementsPackage = await generateFinancialStatementsPackage(args.context, {
    startDate: range.startDate,
    endDate: range.endDate,
    asOf: range.asOf,
    periodKey,
  });

  // 3. Build Reconciliation Certificate at period close timestamp
  const endTimestamp = new Date(range.asOf + "T23:59:59.999Z").getTime();
  const [entryRows, lineRows, eventRows, positionRows, fxRateRows] = await Promise.all([
    db.select({ id: journalEntries.id, eventId: journalEntries.eventId, status: journalEntries.status, reversalOfEntryId: journalEntries.reversalOfEntryId }).from(journalEntries).where(and(eq(journalEntries.workspaceId, workspaceId), lte(journalEntries.postedAt, endTimestamp))),
    db.select({ id: journalLines.id, entryId: journalLines.entryId, accountId: journalLines.accountId, direction: journalLines.direction, amount: journalLines.amount, baseAmount: journalLines.baseAmount, currency: journalLines.currency }).from(journalLines).where(eq(journalLines.workspaceId, workspaceId)),
    db.select({ id: financialEvents.id, status: financialEvents.status, primaryAccountId: financialEvents.primaryAccountId, instrumentId: financialEvents.instrumentId, eventType: financialEvents.eventType, currency: financialEvents.currency, quantity: financialEvents.quantity, unitPrice: financialEvents.unitPrice, grossAmount: financialEvents.grossAmount, feeAmount: financialEvents.feeAmount, taxAmount: financialEvents.taxAmount, idempotencyKey: financialEvents.idempotencyKey }).from(financialEvents).where(and(eq(financialEvents.workspaceId, workspaceId), lte(financialEvents.occurredAt, endTimestamp))),
    db.select({ accountId: positions.accountId, instrumentId: positions.instrumentId, quantity: positions.quantity, averageCost: positions.averageCost }).from(positions).where(eq(positions.workspaceId, workspaceId)),
    db.select({ fromCurrency: fxRates.fromCurrency, toCurrency: fxRates.toCurrency, rate: fxRates.rate, asOf: fxRates.asOf, rateStatus: fxRates.rateStatus }).from(fxRates).where(eq(fxRates.workspaceId, workspaceId)).orderBy(desc(fxRates.asOf)),
  ]);

  const reconEntries: ReconciliationEntry[] = entryRows.map(r => ({ id: r.id, eventId: r.eventId, status: r.status, reversalOfEntryId: r.reversalOfEntryId }));
  const reconLines: ReconciliationLine[] = lineRows.map(r => ({ id: r.id, entryId: r.entryId, accountId: r.accountId, direction: r.direction as "debit" | "credit", amount: r.amount, baseAmount: r.baseAmount, currency: r.currency }));
  const reconEvents: ReconciliationEvent[] = eventRows.map(r => ({ id: r.id, status: r.status, primaryAccountId: r.primaryAccountId, instrumentId: r.instrumentId, eventType: r.eventType, currency: r.currency, quantity: r.quantity, unitPrice: r.unitPrice, grossAmount: r.grossAmount, feeAmount: r.feeAmount, taxAmount: r.taxAmount, idempotencyKey: r.idempotencyKey }));
  const reconPositions: ReconciliationPosition[] = positionRows.map(r => ({ accountId: r.accountId, instrumentId: r.instrumentId, quantity: r.quantity, averageCost: r.averageCost }));
  const reconFxRates: ReconciliationFxRate[] = fxRateRows.map(r => ({ fromCurrency: r.fromCurrency, toCurrency: r.toCurrency, rate: r.rate, asOf: r.asOf, rateStatus: r.rateStatus }));

  const reconciliationReport = buildReconciliationReport({
    baseCurrency: args.context.workspace.baseCurrency,
    entries: reconEntries,
    lines: reconLines,
    events: reconEvents,
    positions: reconPositions,
    fxRates: reconFxRates,
    generatedAt: endTimestamp,
  });

  // 4. Fetch latest Official Valuation Snapshot metadata
  const [latestOfficialSnapshot] = await db
    .select({ id: officialValuationSnapshots.id, capturedAt: officialValuationSnapshots.capturedAt })
    .from(officialValuationSnapshots)
    .where(and(eq(officialValuationSnapshots.workspaceId, workspaceId), lte(officialValuationSnapshots.capturedAt, endTimestamp)))
    .orderBy(desc(officialValuationSnapshots.capturedAt))
    .limit(1);

  // 5. Build Canonical Dossier
  const now = Date.now();
  const preliminaryDossier: Omit<FrozenAuditDossier, "fingerprint"> = {
    metadata: {
      dossierVersion: "v1.0",
      periodKey,
      workspaceId,
      workspaceName: args.context.workspace.name,
      baseCurrency: args.context.workspace.baseCurrency,
      closedAt: now,
      closedByUserId: args.actorUserId,
      closeApprovalRequestId: args.closeApprovalRequestId,
      epistemology: "AUTHORITATIVE_FACT",
    },
    financialStatements: {
      balanceSheet: statementsPackage.bookBalanceSheet,
      incomeStatement: statementsPackage.incomeStatement,
      cashFlow: statementsPackage.cashFlowStatement,
      equityChanges: statementsPackage.equityChangesStatement,
      economicBridge: statementsPackage.economicNetWorthBridge,
      reconciliationAudit: statementsPackage.reconciliationAudit,
    },
    reconciliationCertificate: {
      status: reconciliationReport.status,
      unbalancedEntriesCount: reconciliationReport.unbalancedEntries.length,
      orphanLinesCount: reconciliationReport.orphanLines.length,
      notes: reconciliationReport.notes,
      certifiedAt: now,
    },
    valuationMetadata: {
      officialSnapshotId: latestOfficialSnapshot?.id ?? null,
      capturedAt: latestOfficialSnapshot?.capturedAt ?? null,
    },
  };

  // 6. Compute Deterministic SHA-256 Fingerprint
  const canonicalJson = JSON.stringify(preliminaryDossier, Object.keys(preliminaryDossier).sort(), 2);
  const sha256 = computeDossierFingerprint(canonicalJson);

  const finalDossier: FrozenAuditDossier = {
    ...preliminaryDossier,
    fingerprint: {
      algorithm: "SHA-256",
      sha256,
    },
  };

  const finalJson = JSON.stringify(finalDossier, null, 2);
  const bytes = Buffer.from(finalJson, "utf8");

  // 7. Store in Vault with AES-256-GCM Encryption
  const storagePath = `vault/${workspaceId}/periods/${periodKey}-${sha256.slice(0, 16)}.json`;
  const storedObject = await storagePut(storagePath, bytes, "application/json");

  const originalName = `audit_dossier_${periodKey}.json`;
  const encryptedStorageKey = encryptVaultValue(storedObject.key);
  const encryptedOriginalName = encryptVaultValue(originalName);

  const inserted = await db.insert(vaultDocuments).values({
    workspaceId,
    profileId,
    encryptedStorageKey,
    encryptedOriginalName,
    mimeType: "application/json",
    byteSize: bytes.length,
    sha256,
    linkedEntityType: "financial_period",
    linkedEntityId: periodKey,
    createdByUserId: args.actorUserId,
    createdAt: now,
    updatedAt: now,
  });

  const documentId = Number(inserted[0].insertId);

  // 8. Audit Event
  await db.insert(auditEvents).values({
    workspaceId,
    actorUserId: args.actorUserId,
    action: "period_closure.dossier_archived",
    targetType: "vault_document",
    targetId: String(documentId),
    beforeState: null,
    afterState: {
      periodKey,
      sha256,
      byteSize: bytes.length,
      documentId,
      closeApprovalRequestId: args.closeApprovalRequestId,
    },
    requestId: crypto.randomUUID(),
    occurredAt: now,
  });

  invalidateReadModelCache(`vault:${workspaceId}:`);

  return {
    archived: true,
    duplicate: false,
    documentId,
    sha256,
    periodKey,
  };
}

export async function getPeriodClosureDossier(context: FamilyContext, periodKey: string) {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة بيانات FAMILY غير متاحة." });
  }

  const [document] = await db
    .select()
    .from(vaultDocuments)
    .where(
      and(
        eq(vaultDocuments.workspaceId, context.workspace.id),
        eq(vaultDocuments.linkedEntityType, "financial_period"),
        eq(vaultDocuments.linkedEntityId, periodKey.trim())
      )
    )
    .limit(1);

  if (!document) {
    return null;
  }

  let storageKey: string;
  let originalName: string;
  try {
    storageKey = decryptVaultValue(document.encryptedStorageKey);
    originalName = decryptVaultValue(document.encryptedOriginalName);
  } catch {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر فك تشفير مستند الأرشيف المحمي." });
  }

  const url = await storageGetSignedUrl(storageKey);

  return {
    documentId: document.id,
    periodKey,
    sha256: document.sha256,
    byteSize: document.byteSize,
    originalName,
    createdAt: document.createdAt,
    downloadUrl: url,
  };
}
