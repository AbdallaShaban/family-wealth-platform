import { and, desc, eq, inArray, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "./db";
import { protectedProcedure, router } from "./_core/trpc";
import { listAccessibleWorkspaces } from "./familyAccess";
import {
  accounts,
  debts,
  fxRates,
  instruments,
  journalLines,
  memberships,
  personalIous,
  positions,
  priceQuotes,
  workspaces,
} from "../drizzle/schema";
import { calculateConsolidation, type FxRateResolver, type RawWorkspaceEntity } from "./consolidationMath";
import { getCachedReadModel } from "./readModelCache";

export const consolidationRouter = router({
  listAccessible: protectedProcedure.query(async ({ ctx }) => {
    return listAccessibleWorkspaces(ctx.user);
  }),

  summary: protectedProcedure
    .input(
      z.object({
        workspaceIds: z.array(z.number().int().positive()).min(1).max(20),
        presentationCurrency: z.string().trim().regex(/^[A-Za-z]{3}$/, "أدخل رمز عملة ISO من ثلاثة أحرف.").default("SAR"),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة بيانات FAMILY غير متاحة حاليًا." });
      }

      const presentationCurrency = input.presentationCurrency.toUpperCase();
      const sortedWorkspaceIds = [...input.workspaceIds].sort((a, b) => a - b);

      // 1. Strict RBAC verification: Ensure user has active membership in ALL requested workspaces
      const userMemberships = await db
        .select({
          workspaceId: memberships.workspaceId,
          role: memberships.role,
          workspaceName: workspaces.name,
          baseCurrency: workspaces.baseCurrency,
        })
        .from(memberships)
        .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
        .where(
          and(
            eq(memberships.userId, ctx.user.id),
            eq(memberships.status, "active"),
            inArray(memberships.workspaceId, sortedWorkspaceIds)
          )
        );

      if (userMemberships.length !== sortedWorkspaceIds.length) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "غير مصرح بالوصول إلى مساحة عمل واحدة أو أكثر من المساحات المحددة للدمج.",
        });
      }

      const membershipMap = new Map(userMemberships.map(m => [m.workspaceId, m]));

      // 2. Read-Model Cache with workspace and user isolation
      const cacheKey = `consolidation:${ctx.user.id}:${sortedWorkspaceIds.join(",")}:${presentationCurrency}`;

      return getCachedReadModel(cacheKey, async () => {
        // 3. Load latest FX rates to presentation currency across all workspaces
        const rateRows = await db
          .select()
          .from(fxRates)
          .where(
            and(
              inArray(fxRates.workspaceId, sortedWorkspaceIds),
              eq(fxRates.toCurrency, presentationCurrency)
            )
          )
          .orderBy(desc(fxRates.asOf));

        const fxRateMap = new Map<string, { rate: Decimal; source: string; asOf: number }>();
        for (const row of rateRows) {
          const key = `${row.fromCurrency.toUpperCase()}->${row.toCurrency.toUpperCase()}`;
          if (!fxRateMap.has(key)) {
            fxRateMap.set(key, {
              rate: new Decimal(row.rate),
              source: row.source,
              asOf: row.asOf,
            });
          }
        }

        const fxResolver: FxRateResolver = (from, to) => {
          const key = `${from.toUpperCase()}->${to.toUpperCase()}`;
          return fxRateMap.get(key) ?? null;
        };

        // 4. Concurrently fetch domain entities for all requested workspaces (Read-Only)
        const rawEntities: RawWorkspaceEntity[] = [];

        for (const workspaceId of sortedWorkspaceIds) {
          const meta = membershipMap.get(workspaceId)!;

          const [accountRows, positionRows, quoteRows, debtRows, iouRows] = await Promise.all([
            // Accounts & ledger balances
            db
              .select({
                id: accounts.id,
                name: accounts.name,
                accountType: accounts.accountType,
                currency: accounts.currency,
                balance: sql<string>`COALESCE(SUM(CASE WHEN ${journalLines.direction} = 'debit' THEN ${journalLines.amount} ELSE -${journalLines.amount} END), 0)`,
              })
              .from(accounts)
              .leftJoin(
                journalLines,
                and(eq(journalLines.accountId, accounts.id), eq(journalLines.workspaceId, workspaceId))
              )
              .where(and(eq(accounts.workspaceId, workspaceId), eq(accounts.isSystemAccount, "no")))
              .groupBy(accounts.id, accounts.name, accounts.accountType, accounts.currency),

            // Positions & instruments
            db
              .select({
                instrumentId: positions.instrumentId,
                instrumentName: instruments.name,
                assetType: instruments.assetType,
                quantity: positions.quantity,
                currency: instruments.currency,
              })
              .from(positions)
              .innerJoin(instruments, eq(positions.instrumentId, instruments.id))
              .where(and(eq(positions.workspaceId, workspaceId), sql`${positions.quantity} > 0`)),

            // Latest price quotes
            db
              .select()
              .from(priceQuotes)
              .where(eq(priceQuotes.workspaceId, workspaceId))
              .orderBy(desc(priceQuotes.asOf)),

            // Debts
            db
              .select({
                id: debts.id,
                creditorName: debts.lender,
                liabilityAccountId: debts.liabilityAccountId,
                originalPrincipal: debts.originalPrincipal,
                currency: debts.currency,
              })
              .from(debts)
              .where(and(eq(debts.workspaceId, workspaceId), eq(debts.status, "active"))),

            // Personal IOUs
            db
              .select({
                id: personalIous.id,
                counterpartyName: personalIous.counterpartyName,
                direction: personalIous.direction,
                amount: personalIous.amount,
                currency: personalIous.currency,
                status: personalIous.status,
              })
              .from(personalIous)
              .where(and(eq(personalIous.workspaceId, workspaceId), eq(personalIous.status, "active"))),
          ]);

          // Match latest price per instrument
          const quoteMap = new Map<number, Decimal>();
          for (const q of quoteRows) {
            if (!quoteMap.has(q.instrumentId)) {
              quoteMap.set(q.instrumentId, new Decimal(q.price));
            }
          }

          // Build portfolio items
          const portfolioItems = positionRows.map(pos => {
            const qty = new Decimal(pos.quantity);
            const price = quoteMap.get(pos.instrumentId) ?? new Decimal(0);
            return {
              instrumentId: pos.instrumentId,
              instrumentName: pos.instrumentName,
              assetType: pos.assetType,
              quantity: qty,
              currency: pos.currency,
              marketValue: qty.mul(price),
            };
          });

          // Aggregate workspace-level totals in local currency
          const accountsList = accountRows.map(acc => ({
            id: acc.id,
            name: acc.name,
            accountType: acc.accountType,
            currency: acc.currency,
            balance: new Decimal(acc.balance),
          }));

          const liquidCash = accountsList
            .filter(a => ["cash", "bank", "brokerage", "wallet"].includes(a.accountType))
            .reduce((sum, a) => sum.plus(a.balance), new Decimal(0));

          const assetValue = accountsList
            .filter(a => a.accountType === "asset")
            .reduce((sum, a) => sum.plus(a.balance), new Decimal(0));

          const liabilities = accountsList
            .filter(a => ["credit", "loan"].includes(a.accountType))
            .reduce((sum, a) => sum.plus(a.balance.abs()), new Decimal(0));

          const investmentValue = portfolioItems.reduce((sum, p) => sum.plus(p.marketValue), new Decimal(0));

          const grossBookNetWorth = liquidCash.plus(assetValue).minus(liabilities);
          const economicNetWorth = grossBookNetWorth.plus(investmentValue);

          const debtsList = debtRows.map(d => ({
            id: d.id,
            creditorName: d.creditorName,
            liabilityAccountId: d.liabilityAccountId,
            outstandingBalance: new Decimal(d.originalPrincipal),
            currency: d.currency,
          }));

          const iousList = iouRows.map(iou => ({
            id: iou.id,
            counterpartyName: iou.counterpartyName,
            direction: iou.direction as "receivable" | "payable",
            amount: new Decimal(iou.amount),
            currency: iou.currency,
            status: iou.status,
          }));

          rawEntities.push({
            workspaceId,
            workspaceName: meta.workspaceName,
            baseCurrency: meta.baseCurrency,
            role: meta.role,
            grossBookNetWorth,
            economicNetWorth,
            liquidCash,
            investmentValue,
            assetValue,
            liabilities,
            accounts: accountsList,
            portfolio: portfolioItems,
            debts: debtsList,
            ious: iousList,
          });
        }

        // 5. Execute pure consolidation calculation
        return calculateConsolidation(rawEntities, presentationCurrency, fxResolver);
      });
    }),
});
