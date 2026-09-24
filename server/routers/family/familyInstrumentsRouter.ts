import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, gt, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import crypto from "node:crypto";
import { protectedProcedure, router } from "../../_core/trpc";
import { assertRole, ensurePersonalFamilyContext } from "../../familyAccess";
import { currency } from "../../schemas/familySchemas";
import { getDb } from "../../db";
import {
  instruments,
  auditEvents,
  positions,
  financialEvents,
  investmentLots,
  priceQuotes,
  watchlistItems,
} from "../../../drizzle/schema";

export function normalizeAssetType(val: unknown): "equity" | "fund" | "bond" | "gold" | "real_estate" | "cash_equivalent" | "other" {
  if (typeof val !== "string") return "other";
  const cleaned = val.trim().toLowerCase();
  if (["equity", "fund", "bond", "gold", "real_estate", "cash_equivalent", "other"].includes(cleaned)) {
    return cleaned as "equity" | "fund" | "bond" | "gold" | "real_estate" | "cash_equivalent" | "other";
  }
  if (["stock", "stocks", "shares", "سهم", "أسهم", "سهم مدرج"].includes(cleaned)) return "equity";
  if (["funds", "etf", "mutual_fund", "صندوق", "صناديق", "صندوق استثمار"].includes(cleaned)) return "fund";
  if (["bonds", "sukuk", "treasury", "سند", "سندات", "صكوك", "أذون"].includes(cleaned)) return "bond";
  if (["bullion", "metals", "ذهب", "معادن", "ذهب عيني"].includes(cleaned)) return "gold";
  if (["realestate", "property", "reit", "عقار", "عقارات", "أصول عقارية"].includes(cleaned)) return "real_estate";
  if (["cash", "money_market", "نقد", "كاش", "ما يعادل النقد", "سيولة"].includes(cleaned)) return "cash_equivalent";
  return "other";
}

export const familyInstrumentsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة" });
    return db.select().from(instruments).where(eq(instruments.workspaceId, family.workspace.id)).orderBy(instruments.name);
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().trim().min(2, "اسم الأداة يجب أن لا يقل عن حرفين").max(200),
      symbol: z.string().trim().max(48).optional().nullable(),
      assetType: z.string().trim().min(1, "نوع الفئة مطلوب"),
      subCategory: z.string().trim().max(100).optional().nullable(),
      sector: z.string().trim().max(100).optional().nullable(),
      currency,
      isin: z.string().trim().max(32).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const family = await ensurePersonalFamilyContext(ctx.user);
        assertRole(family, "editor");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة" });

        const canonicalAssetType = normalizeAssetType(input.assetType);
        const cleanSymbol = input.symbol?.trim() ? input.symbol.trim().toUpperCase() : null;

        if (cleanSymbol) {
          const [existing] = await db
            .select({ id: instruments.id, name: instruments.name })
            .from(instruments)
            .where(and(eq(instruments.workspaceId, family.workspace.id), eq(instruments.symbol, cleanSymbol)))
            .limit(1);
          if (existing) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `الأداة المالية بالرمز (${cleanSymbol}) مسجلة مسبقًا باسم "${existing.name}".`,
            });
          }
        }

        const now = Date.now();
        const result = await db.insert(instruments).values({
          workspaceId: family.workspace.id,
          name: input.name.trim(),
          symbol: cleanSymbol,
          assetType: canonicalAssetType,
          subCategory: input.subCategory?.trim() || null,
          sector: input.sector?.trim() || null,
          currency: input.currency.toUpperCase(),
          isin: input.isin?.trim() ? input.isin.trim().toUpperCase() : null,
          createdAt: now,
          updatedAt: now,
        });

        const id = Number(result[0].insertId);
        await db.insert(auditEvents).values({
          workspaceId: family.workspace.id,
          actorUserId: ctx.user.id,
          action: "instrument.created",
          targetType: "instrument",
          targetId: String(id),
          beforeState: null,
          afterState: {
            name: input.name.trim(),
            symbol: cleanSymbol,
            assetType: canonicalAssetType,
            subCategory: input.subCategory?.trim() || null,
            sector: input.sector?.trim() || null,
          },
          requestId: crypto.randomUUID(),
          occurredAt: now,
        });

        return { id, name: input.name.trim(), symbol: cleanSymbol, assetType: canonicalAssetType };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("[Instruments.create] Error creating instrument:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? `فشل حفظ الأداة: ${err.message}` : "فشل حفظ الأداة الاستثمارية في قاعدة البيانات.",
        });
      }
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().trim().optional(),
      symbol: z.string().trim().max(48).optional().nullable(),
      ticker: z.string().trim().max(48).optional().nullable(),
      assetType: z.string().trim().optional(),
      category: z.string().trim().optional(),
      subCategory: z.string().trim().max(100).optional().nullable(),
      sector: z.string().trim().max(100).optional().nullable(),
      currency: currency.optional(),
      isin: z.string().trim().max(32).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const family = await ensurePersonalFamilyContext(ctx.user);
        assertRole(family, "editor");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة" });

        const [existing] = await db
          .select()
          .from(instruments)
          .where(and(eq(instruments.id, input.id), eq(instruments.workspaceId, family.workspace.id)))
          .limit(1);

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "الأداة المالية غير موجودة.",
          });
        }

        const resolvedName = input.name !== undefined ? input.name.trim() : existing.name;
        const rawSymbol = input.ticker !== undefined ? input.ticker : input.symbol;
        const cleanSymbol = rawSymbol !== undefined
          ? (rawSymbol?.trim() ? rawSymbol.trim().toUpperCase() : null)
          : existing.symbol;

        const rawCategory = input.category !== undefined ? input.category : input.assetType;
        const canonicalAssetType = rawCategory !== undefined ? normalizeAssetType(rawCategory) : existing.assetType;
        const subCategoryValue = input.subCategory !== undefined ? (input.subCategory?.trim() || null) : existing.subCategory;
        const sectorValue = input.sector !== undefined ? (input.sector?.trim() || null) : existing.sector;

        if (cleanSymbol) {
          const [conflict] = await db
            .select({ id: instruments.id, name: instruments.name })
            .from(instruments)
            .where(and(
              eq(instruments.workspaceId, family.workspace.id),
              eq(instruments.symbol, cleanSymbol),
              sql`${instruments.id} != ${input.id}`
            ))
            .limit(1);
          if (conflict) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `الأداة المالية بالرمز (${cleanSymbol}) مسجلة مسبقًا باسم "${conflict.name}".`,
            });
          }
        }

        const now = Date.now();
        const nextCurrency = input.currency ? input.currency.toUpperCase() : existing.currency;

        await db
          .update(instruments)
          .set({
            name: resolvedName,
            symbol: cleanSymbol,
            assetType: canonicalAssetType,
            subCategory: subCategoryValue,
            sector: sectorValue,
            currency: nextCurrency,
            isin: input.isin !== undefined ? (input.isin?.trim() ? input.isin.trim().toUpperCase() : null) : existing.isin,
            updatedAt: now,
          })
          .where(eq(instruments.id, input.id));

        await db.insert(auditEvents).values({
          workspaceId: family.workspace.id,
          actorUserId: ctx.user.id,
          action: "instrument.updated",
          targetType: "instrument",
          targetId: String(input.id),
          beforeState: {
            name: existing.name,
            symbol: existing.symbol,
            assetType: existing.assetType,
            subCategory: existing.subCategory,
            sector: existing.sector,
            currency: existing.currency,
          },
          afterState: {
            name: resolvedName,
            symbol: cleanSymbol,
            assetType: canonicalAssetType,
            subCategory: subCategoryValue,
            sector: sectorValue,
            currency: nextCurrency,
          },
          requestId: crypto.randomUUID(),
          occurredAt: now,
        });

        return { id: input.id, name: resolvedName, symbol: cleanSymbol, assetType: canonicalAssetType };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("[Instruments.update] Error:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "فشل تحديث الأداة الاستثمارية.",
        });
      }
    }),

  delete: protectedProcedure
    .input(z.object({
      id: z.number().int().positive("معرف الأداة مطلوب"),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const family = await ensurePersonalFamilyContext(ctx.user);
        assertRole(family, "editor");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة" });

        const [existing] = await db
          .select()
          .from(instruments)
          .where(and(eq(instruments.id, input.id), eq(instruments.workspaceId, family.workspace.id)))
          .limit(1);

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "الأداة المالية غير موجودة.",
          });
        }

        // Safe check: Active holdings in positions
        const [activePos] = await db
          .select({ id: positions.id, quantity: positions.quantity })
          .from(positions)
          .where(and(
            eq(positions.workspaceId, family.workspace.id),
            eq(positions.instrumentId, input.id),
            gt(positions.quantity, "0")
          ))
          .limit(1);

        if (activePos && new Decimal(activePos.quantity).gt(0)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "لا يمكن حذف هذه الأداة المالية لأنها تمتلك رصيد حيازات نشط في المحفظة.",
          });
        }

        // Safe check: Ledger transactions / financial events
        const [linkedEvent] = await db
          .select({ id: financialEvents.id })
          .from(financialEvents)
          .where(and(
            eq(financialEvents.workspaceId, family.workspace.id),
            eq(financialEvents.instrumentId, input.id)
          ))
          .limit(1);

        if (linkedEvent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "لا يمكن حذف هذه الأداة المالية لوجود قيود محاسبية وعمليات مالية مسجلة عليها في دفتر الأستاذ.",
          });
        }

        // Safe check: Investment lots
        const [linkedLot] = await db
          .select({ id: investmentLots.id })
          .from(investmentLots)
          .where(and(
            eq(investmentLots.workspaceId, family.workspace.id),
            eq(investmentLots.instrumentId, input.id)
          ))
          .limit(1);

        if (linkedLot) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "لا يمكن حذف هذه الأداة المالية لوجود سجلات تخصيص Lots مرتبطة بها.",
          });
        }

        // Clean up dependent quotes, watchlists, zero-positions
        await db.delete(priceQuotes).where(and(
          eq(priceQuotes.workspaceId, family.workspace.id),
          eq(priceQuotes.instrumentId, input.id)
        ));
        await db.delete(watchlistItems).where(and(
          eq(watchlistItems.workspaceId, family.workspace.id),
          eq(watchlistItems.instrumentId, input.id)
        ));
        await db.delete(positions).where(and(
          eq(positions.workspaceId, family.workspace.id),
          eq(positions.instrumentId, input.id)
        ));

        await db.delete(instruments).where(eq(instruments.id, input.id));

        const now = Date.now();
        await db.insert(auditEvents).values({
          workspaceId: family.workspace.id,
          actorUserId: ctx.user.id,
          action: "instrument.deleted",
          targetType: "instrument",
          targetId: String(input.id),
          beforeState: {
            name: existing.name,
            symbol: existing.symbol,
            assetType: existing.assetType,
          },
          afterState: null,
          requestId: crypto.randomUUID(),
          occurredAt: now,
        });

        return { success: true, id: input.id };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("[Instruments.delete] Error:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "فشل حذف الأداة الاستثمارية.",
        });
      }
    }),
});
