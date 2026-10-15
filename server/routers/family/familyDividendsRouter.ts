import { router, protectedProcedure } from "../../_core/trpc";
import { ensurePersonalFamilyContext } from "../../familyAccess";
import { getDividendAnalytics } from "../../services/dividendAnalyticsService";

export const familyDividendsRouter = router({
  getAnalytics: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    return getDividendAnalytics(family);
  }),

  getSummary: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const data = await getDividendAnalytics(family);
    return data.summary;
  }),

  getCalendar: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const data = await getDividendAnalytics(family);
    return data.calendar;
  }),

  getHoldingsYield: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const data = await getDividendAnalytics(family);
    return data.holdingsYield;
  }),
});
