import { createHash } from "node:crypto";
import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import Decimal from "decimal.js";
import { getDb } from "./db";
import type { FamilyContext } from "./familyAccess";
import {
  accounts,
  approvalRequests,
  auditEvents,
  corporateActions,
  financialEvents,
  financialPeriods,
  fxRates,
  journalEntries,
  journalLines,
  officialValuationSnapshots,
  positions,
  priceQuotes,
  vaultDocuments,
} from "../drizzle/schema";
import { generateFinancialStatementsPackage } from "./financialStatementsRouter";
import { buildReconciliationReport, type ReconciliationCorporateAction, type ReconciliationEntry, type ReconciliationEvent, type ReconciliationFxRate, type ReconciliationLine, type ReconciliationPosition } from "./reconciliation";
import { encryptVaultValue, decryptVaultValue } from "./vaultCrypto";
import { storageDelete, storageGetSignedUrl, storagePut } from "./storage";
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
  const [entryRows, lineRows, eventRows, positionRows, fxRateRows, corporateActionRows] = await Promise.all([
    db.select({ id: journalEntries.id, eventId: journalEntries.eventId, status: journalEntries.status, reversalOfEntryId: journalEntries.reversalOfEntryId }).from(journalEntries).where(and(eq(journalEntries.workspaceId, workspaceId), lte(journalEntries.postedAt, endTimestamp))),
    db.select({ id: journalLines.id, entryId: journalLines.entryId, accountId: journalLines.accountId, direction: journalLines.direction, amount: journalLines.amount, baseAmount: journalLines.baseAmount, currency: journalLines.currency }).from(journalLines).where(eq(journalLines.workspaceId, workspaceId)),
    db.select({ id: financialEvents.id, status: financialEvents.status, primaryAccountId: financialEvents.primaryAccountId, instrumentId: financialEvents.instrumentId, eventType: financialEvents.eventType, currency: financialEvents.currency, quantity: financialEvents.quantity, unitPrice: financialEvents.unitPrice, grossAmount: financialEvents.grossAmount, feeAmount: financialEvents.feeAmount, taxAmount: financialEvents.taxAmount, idempotencyKey: financialEvents.idempotencyKey, occurredAt: financialEvents.occurredAt }).from(financialEvents).where(and(eq(financialEvents.workspaceId, workspaceId), lte(financialEvents.occurredAt, endTimestamp))),
    db.select({ accountId: positions.accountId, instrumentId: positions.instrumentId, quantity: positions.quantity, averageCost: positions.averageCost }).from(positions).where(eq(positions.workspaceId, workspaceId)),
    db.select({ fromCurrency: fxRates.fromCurrency, toCurrency: fxRates.toCurrency, rate: fxRates.rate, asOf: fxRates.asOf, rateStatus: fxRates.rateStatus }).from(fxRates).where(eq(fxRates.workspaceId, workspaceId)).orderBy(desc(fxRates.asOf)),
    db.select({ instrumentId: corporateActions.instrumentId, actionType: corporateActions.actionType, ratio: corporateActions.ratio, effectiveAt: corporateActions.effectiveAt }).from(corporateActions).where(and(eq(corporateActions.workspaceId, workspaceId), lte(corporateActions.effectiveAt, endTimestamp))),
  ]);

  const reconEntries: ReconciliationEntry[] = entryRows.map(r => ({ id: r.id, eventId: r.eventId, status: r.status, reversalOfEntryId: r.reversalOfEntryId }));
  const reconLines: ReconciliationLine[] = lineRows.map(r => ({ id: r.id, entryId: r.entryId, accountId: r.accountId, direction: r.direction as "debit" | "credit", amount: r.amount, baseAmount: r.baseAmount, currency: r.currency }));
  const reconEvents: ReconciliationEvent[] = eventRows.map(r => ({ id: r.id, status: r.status, primaryAccountId: r.primaryAccountId, instrumentId: r.instrumentId, eventType: r.eventType, currency: r.currency, quantity: r.quantity, unitPrice: r.unitPrice, grossAmount: r.grossAmount, feeAmount: r.feeAmount, taxAmount: r.taxAmount, idempotencyKey: r.idempotencyKey, occurredAt: r.occurredAt }));
  const reconPositions: ReconciliationPosition[] = positionRows.map(r => ({ accountId: r.accountId, instrumentId: r.instrumentId, quantity: r.quantity, averageCost: r.averageCost }));
  const reconFxRates: ReconciliationFxRate[] = fxRateRows.map(r => ({ fromCurrency: r.fromCurrency, toCurrency: r.toCurrency, rate: r.rate, asOf: r.asOf, rateStatus: r.rateStatus }));
  const reconCorporateActions: ReconciliationCorporateAction[] = corporateActionRows.map(r => ({ instrumentId: r.instrumentId, actionType: r.actionType, ratio: r.ratio, effectiveAt: r.effectiveAt }));

  const reconciliationReport = buildReconciliationReport({
    baseCurrency: args.context.workspace.baseCurrency,
    entries: reconEntries,
    lines: reconLines,
    events: reconEvents,
    positions: reconPositions,
    fxRates: reconFxRates,
    corporateActions: reconCorporateActions,
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

  // 7. Staging-First: Upload to staging key outside MySQL transaction
  const stagingStoragePath = `vault/${workspaceId}/periods/staging-${periodKey}-${sha256.slice(0, 16)}.json`;
  let storedObject: { key: string; url: string };
  try {
    storedObject = await storagePut(stagingStoragePath, bytes, "application/json");
    if (!storedObject || !storedObject.key) {
      throw new Error("Object storage returned invalid or empty key");
    }
  } catch (storageErr) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `فشل رفع ملف الأرشيف إلى التخزين السحابي: ${(storageErr as Error).message}`,
    });
  }

  // 8. Execute Atomic Short MySQL Transaction
  let documentId: number;
  try {
    documentId = await db.transaction(async tx => {
      // 8a. Close financial period
      await tx
        .insert(financialPeriods)
        .values({
          workspaceId,
          periodKey,
          status: "closed",
          closedByUserId: args.actorUserId,
          closedAt: now,
          closeApprovalRequestId: args.closeApprovalRequestId ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .onDuplicateKeyUpdate({
          set: {
            status: "closed",
            closedByUserId: args.actorUserId,
            closedAt: now,
            closeApprovalRequestId: args.closeApprovalRequestId ?? null,
            updatedAt: now,
          },
        });

      // 8b. Execute approval request if specified
      if (args.closeApprovalRequestId) {
        await tx
          .update(approvalRequests)
          .set({ status: "executed", updatedAt: now })
          .where(
            and(
              eq(approvalRequests.id, args.closeApprovalRequestId),
              eq(approvalRequests.workspaceId, workspaceId)
            )
          );
      }

      // 8c. Insert vault document metadata
      const originalName = `audit_dossier_${periodKey}.json`;
      const encryptedStorageKey = encryptVaultValue(storedObject.key);
      const encryptedOriginalName = encryptVaultValue(originalName);

      const inserted = await tx.insert(vaultDocuments).values({
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

      const docId = Number(inserted[0].insertId);

      // 8d. Record required audit event
      await tx.insert(auditEvents).values({
        workspaceId,
        actorUserId: args.actorUserId,
        action: "period_closure.dossier_archived",
        targetType: "vault_document",
        targetId: String(docId),
        beforeState: null,
        afterState: {
          periodKey,
          sha256,
          byteSize: bytes.length,
          documentId: docId,
          closeApprovalRequestId: args.closeApprovalRequestId ?? null,
        },
        requestId: crypto.randomUUID(),
        occurredAt: now,
      });

      return docId;
    });
  } catch (dbErr) {
    // 9. Compensating cleanup: delete staged storage object on DB failure
    console.error(`[PeriodArchival] DB transaction failed for ${periodKey}. Executing compensating deletion of ${storedObject.key}...`, dbErr);
    try {
      const deleted = await storageDelete(storedObject.key);
      if (!deleted) {
        console.error(`[PeriodArchival] CRITICAL: Compensating cleanup failed to delete key ${storedObject.key}`);
      }
    } catch (cleanupErr) {
      console.error(`[PeriodArchival] CRITICAL: Compensating cleanup threw error for key ${storedObject.key}:`, cleanupErr);
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `فشل تثبيت إغلاق الفترة في قاعدة البيانات: ${(dbErr as Error).message}`,
    });
  }

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
