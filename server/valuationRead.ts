import { and, desc, eq } from "drizzle-orm";
import { valuationProvenance, valuationSnapshots } from "../drizzle/schema";
import type { FamilyContext } from "./familyAccess";
import { getDb } from "./db";

export async function listValuationHistory(context: FamilyContext, limit = 100) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات FAMILY غير متاحة حاليًا.");
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const rows = await db.select({
    snapshot: valuationSnapshots,
    provenance: valuationProvenance,
  }).from(valuationSnapshots)
    .innerJoin(valuationProvenance, eq(valuationSnapshots.provenanceId, valuationProvenance.id))
    .where(and(eq(valuationSnapshots.workspaceId, context.workspace.id), eq(valuationProvenance.workspaceId, context.workspace.id)))
    .orderBy(desc(valuationSnapshots.asOf), desc(valuationSnapshots.capturedAt))
    .limit(safeLimit);

  return rows.map(({ snapshot, provenance }) => ({
    id: snapshot.id,
    subjectType: snapshot.subjectType,
    subjectId: snapshot.subjectId,
    nativeValue: snapshot.nativeValue,
    nativeCurrency: snapshot.nativeCurrency,
    baseValue: snapshot.baseValue,
    baseCurrency: snapshot.baseCurrency,
    quantity: snapshot.quantity,
    unit: snapshot.unit,
    valuationMethod: snapshot.valuationMethod,
    quality: snapshot.quality,
    asOf: snapshot.asOf,
    capturedAt: snapshot.capturedAt,
    quoteId: snapshot.quoteId,
    fxRateId: snapshot.fxRateId,
    provenance: {
      id: provenance.id,
      sourceType: provenance.sourceType,
      provider: provenance.provider,
      source: provenance.source,
      rawSymbol: provenance.rawSymbol,
      normalizedSymbol: provenance.normalizedSymbol,
      fetchedAt: provenance.fetchedAt,
      asOf: provenance.asOf,
      status: provenance.status,
      metadata: provenance.metadata,
    },
  }));
}

export type ValuationHistoryRow = Awaited<ReturnType<typeof listValuationHistory>>[number];
