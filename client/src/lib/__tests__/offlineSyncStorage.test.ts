import { describe, expect, it, beforeEach } from "vitest";
import {
  enqueueOfflineTransaction,
  getPendingTransactions,
  getPendingCount,
  updateTransactionStatus,
  removeOfflineTransaction,
  clearAllPendingTransactions,
  generateOfflineIdempotencyKey,
  cacheAccountsSnapshot,
  getCachedAccounts,
  type OfflineTransactionDraft,
} from "../offlineSyncStorage";

describe("Offline Storage & Sync Engine", () => {
  beforeEach(async () => {
    await clearAllPendingTransactions();
  });

  it("generates a standard compliant idempotency key with correct length", () => {
    const key = generateOfflineIdempotencyKey("expense");
    expect(key).toMatch(/^offline-expense-\d+-[a-z0-9]+-[a-z0-9]+$/);
    expect(key.length).toBeGreaterThanOrEqual(16);
    expect(key.length).toBeLessThanOrEqual(160);
  });

  it("enqueues and retrieves offline transactions in correct FIFO order", async () => {
    const draft1: OfflineTransactionDraft = {
      type: "expense",
      accountId: 101,
      amount: "1500.50",
      currency: "EGP",
      occurredAt: 1728000000000,
      memo: "شراء مستلزمات مكتبية",
    };

    const draft2: OfflineTransactionDraft = {
      type: "deposit",
      accountId: 102,
      amount: "50000.00",
      currency: "EGP",
      occurredAt: 1728000001000,
      memo: "إيداع نقدي بالخزينة",
    };

    const tx1 = await enqueueOfflineTransaction(draft1);
    const tx2 = await enqueueOfflineTransaction(draft2);

    expect(tx1.status).toBe("pending");
    expect(tx1.idempotencyKey).toBeDefined();
    expect(tx2.status).toBe("pending");

    const pending = await getPendingTransactions();
    expect(pending.length).toBe(2);
    expect(pending[0].localId).toBe(tx1.localId);
    expect(pending[1].localId).toBe(tx2.localId);

    const count = await getPendingCount();
    expect(count).toBe(2);
  });

  it("updates transaction status and tracks failure retry counts", async () => {
    const draft: OfflineTransactionDraft = {
      type: "transfer",
      accountId: 101,
      toAccountId: 102,
      amount: "10000.00",
      currency: "EGP",
      occurredAt: Date.now(),
      memo: "تحويل بين الحسابات",
    };

    const tx = await enqueueOfflineTransaction(draft);
    expect(tx.status).toBe("pending");
    expect(tx.retryCount).toBe(0);

    await updateTransactionStatus(tx.localId, "failed", "Network request timeout");

    const list = await getPendingTransactions();
    const updated = list.find((item) => item.localId === tx.localId);
    expect(updated?.status).toBe("failed");
    expect(updated?.retryCount).toBe(1);
    expect(updated?.lastError).toBe("Network request timeout");
  });

  it("removes transactions upon completion or deletion", async () => {
    const draft: OfflineTransactionDraft = {
      type: "expense",
      accountId: 101,
      amount: "250.00",
      currency: "EGP",
      occurredAt: Date.now(),
      memo: "مصروف دوري",
    };

    const tx = await enqueueOfflineTransaction(draft);
    expect(await getPendingCount()).toBe(1);

    await removeOfflineTransaction(tx.localId);
    expect(await getPendingCount()).toBe(0);
  });

  it("caches and retrieves banking accounts snapshot for offline operations", async () => {
    const testAccounts = [
      { id: 1, name: "حساب جاري البنك الأهلي", currency: "EGP", balance: "125000" },
      { id: 2, name: "حساب ادخاري بنك مصر", currency: "EGP", balance: "340000" },
      { id: 3, name: "خزينة السيولة النقدية", currency: "USD", balance: "5000" },
    ];

    await cacheAccountsSnapshot(testAccounts);
    const cached = await getCachedAccounts();
    expect(cached.length).toBe(3);
    expect(cached[0].name).toBe("حساب جاري البنك الأهلي");
  });
});
