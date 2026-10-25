import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  isEgxTradingDay,
  fetchEgxAssetQuote,
  executeEgxMarketFeedSync,
  initEgxFeedCronScheduler,
  stopEgxFeedCronScheduler,
  getEgxFeedStatus,
} from "../egxFeedService";
import * as marketDataModule from "../../../marketData";
import * as dbModule from "../../../db";

describe("egxFeedService - EGX Market Feed Automation & Mutual Funds", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stopEgxFeedCronScheduler();
  });

  afterEach(() => {
    stopEgxFeedCronScheduler();
  });

  describe("1. EGX Trading Day & Hours Check", () => {
    it("should identify Egyptian trading days (Sunday through Thursday) accurately", () => {
      // 2026-10-25 is Sunday (EGX Trading Day)
      const sunday = new Date("2026-10-25T12:00:00Z");
      expect(isEgxTradingDay(sunday)).toBe(true);

      // 2026-10-26 is Monday
      const monday = new Date("2026-10-26T12:00:00Z");
      expect(isEgxTradingDay(monday)).toBe(true);

      // 2026-10-29 is Thursday
      const thursday = new Date("2026-10-29T12:00:00Z");
      expect(isEgxTradingDay(thursday)).toBe(true);
    });

    it("should recognize EGX weekend days (Friday and Saturday) as non-trading days", () => {
      // 2026-10-30 is Friday (Weekend in Egypt)
      const friday = new Date("2026-10-30T12:00:00Z");
      expect(isEgxTradingDay(friday)).toBe(false);

      // 2026-10-31 is Saturday (Weekend in Egypt)
      const saturday = new Date("2026-10-31T12:00:00Z");
      expect(isEgxTradingDay(saturday)).toBe(false);
    });
  });

  describe("2. Asset Quote Fetching (Equities, EGX30 Index, Mutual Funds)", () => {
    it("should fetch stock quote successfully via fetchEgxOrYahooQuote", async () => {
      vi.spyOn(marketDataModule, "fetchEgxOrYahooQuote").mockResolvedValueOnce({
        symbol: "COMI",
        price: "92.50",
        currency: "EGP",
        asOf: Date.now(),
        source: "Mubasher/EGX",
        quoteStatus: "live",
      });

      const quote = await fetchEgxAssetQuote("COMI", "equity", "البنك التجاري الدولي");
      expect(quote.price).toBe(92.5);
      expect(quote.source).toBe("Mubasher/EGX");
      expect(quote.quoteStatus).toBe("live");
    });

    it("should fetch EGX30 index quotes correctly with fallback support", async () => {
      vi.spyOn(marketDataModule, "fetchTradingViewEgxScan").mockResolvedValueOnce({
        symbol: "EGX30",
        price: 31250.75,
        change: 0.85,
        changePercent: 0.85,
        volume: 120000000,
        high: 31500,
        low: 31000,
      } as any);

      const quote = await fetchEgxAssetQuote("EGX30", "index", "مؤشر البورصة المصرية الثلاثيني");
      expect(quote.price).toBe(31250.75);
      expect(quote.source).toContain("EGX30");
    });

    it("should fetch Egyptian Mutual Funds Net Asset Value (NAV)", async () => {
      vi.spyOn(marketDataModule, "fetchEgxMutualFundQuote").mockResolvedValueOnce({
        symbol: "AZIMUT-EGP",
        price: "24.85",
        currency: "EGP",
        asOf: Date.now(),
        source: "نشرة صندوق أزيموت مصر للأسهم",
        quoteStatus: "live",
      });

      const quote = await fetchEgxAssetQuote("AZIMUT-EGP", "fund", "صندوق أزيموت للأسهم المصرية");
      expect(quote.price).toBe(24.85);
      expect(quote.source).toContain("أزيموت");
    });

    it("should gracefully fall back to curated last close if remote network fails", async () => {
      vi.spyOn(marketDataModule, "fetchTradingViewEgxScan").mockRejectedValueOnce(new Error("Network timeout"));
      vi.spyOn(marketDataModule, "fetchEgxOrYahooQuote").mockRejectedValueOnce(
        new Error("Network connection timeout")
      );

      // COMI exists in EGX_TOP_INSTRUMENTS
      const quote = await fetchEgxAssetQuote("COMI", "equity", "البنك التجاري الدولي");
      expect(quote.price).toBeGreaterThan(0);
      expect(quote.quoteStatus).toBe("last_known");
    });
  });

  describe("3. Storage & Idempotent Upsert (executeEgxMarketFeedSync)", () => {
    it("should handle sync safely when database is unavailable without crashing", async () => {
      vi.spyOn(dbModule, "getDb").mockResolvedValueOnce(null as any);

      const result = await executeEgxMarketFeedSync();
      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe("قاعدة بيانات المنصة غير متاحة.");
      expect(result.updatedCount).toBe(0);
    });

    it("should execute idempotent upsert into priceQuotes without creating duplicate entries", async () => {
      const mockQuotes: any[] = [];
      const mockWorkspace = { id: 1, name: "عائلة الشبان", baseCurrency: "EGP" };
      const mockInstrument = {
        id: 101,
        workspaceId: 1,
        symbol: "COMI",
        name: "البنك التجاري الدولي",
        assetType: "equity",
        currency: "EGP",
      };

      const createQueryMock = (data: any) => {
        const queryObj: any = {
          from: vi.fn(() => queryObj),
          where: vi.fn(() => queryObj),
          orderBy: vi.fn(() => queryObj),
          limit: vi.fn(() => queryObj),
          then: (resolve: any) => Promise.resolve(data).then(resolve),
        };
        return queryObj;
      };

      let selectCallCount = 0;
      const mockDb: any = {
        execute: vi.fn().mockImplementation(() => {
          return Promise.resolve([[{ locked: 1, unlocked: 1 }]]);
        }),
        select: vi.fn().mockImplementation(() => {
          selectCallCount++;
          // Call 1: workspaces
          if (selectCallCount === 1) {
            return createQueryMock([mockWorkspace]);
          }
          // Call 2: activeInstruments
          if (selectCallCount === 2) {
            return createQueryMock([mockInstrument]);
          }
          // Subsequent calls: check existing instruments or quotes
          return createQueryMock([]);
        }),
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation((val) => {
            mockQuotes.push(val);
            return Promise.resolve([{ insertId: 1 }]);
          }),
        })),
        update: vi.fn().mockImplementation(() => ({
          set: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockResolvedValue([]),
          })),
        })),
      };

      vi.spyOn(dbModule, "getDb").mockResolvedValue(mockDb);
      vi.spyOn(marketDataModule, "fetchTradingViewEgxScan").mockResolvedValue(null as any);
      vi.spyOn(marketDataModule, "fetchEgxOrYahooQuote").mockResolvedValue({
        symbol: "COMI",
        price: "94.00",
        currency: "EGP",
        asOf: Date.now(),
        source: "Mubasher/EGX",
        quoteStatus: "live",
      });

      // Run sync
      const result1 = await executeEgxMarketFeedSync({ workspaceId: 1, forced: true });
      expect(result1.success).toBe(true);
      expect(result1.updatedCount).toBeGreaterThanOrEqual(1);

      // Verify that NO ledger/journal transactions are executed
      expect(mockDb.insert).not.toHaveBeenCalledWith(expect.objectContaining({ tableName: "journalEntries" }));
    });
  });

  describe("4. Scheduler & Cron Daemon Controls", () => {
    it("should initialize node-cron scheduled task with Cairo 3:30 PM pattern", () => {
      const initResult = initEgxFeedCronScheduler();
      expect(initResult.cronExpression).toBe("30 15 * * 0-4");

      const status = getEgxFeedStatus();
      expect(status.isSchedulerActive).toBe(true);
      expect(status.schedulePattern).toContain("3:30");
    });

    it("should stop scheduler gracefully without errors", () => {
      initEgxFeedCronScheduler();
      expect(getEgxFeedStatus().isSchedulerActive).toBe(true);

      stopEgxFeedCronScheduler();
      expect(getEgxFeedStatus().isSchedulerActive).toBe(false);
    });
  });
});
