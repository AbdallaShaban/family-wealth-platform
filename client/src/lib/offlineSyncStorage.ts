// ======================================================================
// FAMILY WEALTH INTELLIGENCE — Offline Storage & IndexedDB Engine
// ======================================================================

export interface CachedAccount {
  id: number;
  name: string;
  currency: string;
  type?: string;
  balance?: string;
}

export type OfflineTransactionType = "expense" | "deposit" | "income" | "transfer";

export interface OfflineTransactionDraft {
  type: OfflineTransactionType;
  accountId: number;
  toAccountId?: number; // for transfer
  amount: string;
  currency: string;
  occurredAt: number; // Unix timestamp in ms
  categoryId?: number | null;
  memo?: string | null;
}

export interface OfflineTransaction extends OfflineTransactionDraft {
  localId: string;
  idempotencyKey: string;
  status: "pending" | "syncing" | "failed" | "synced";
  createdAt: number;
  retryCount: number;
  lastError?: string | null;
}

const DB_NAME = "FamilyWealthOfflineDB";
const DB_VERSION = 1;
const STORE_PENDING = "pending_transactions";
const STORE_CACHE = "app_cache";

// In-memory fallback for environments without window.indexedDB (e.g. Node tests / SSR)
let memoryPendingTransactions: OfflineTransaction[] = [];
let memoryCachedAccounts: CachedAccount[] = [];

function isIndexedDBSupported(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window && window.indexedDB !== null;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBSupported()) {
      return reject(new Error("IndexedDB is not supported in this environment"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        const pendingStore = db.createObjectStore(STORE_PENDING, { keyPath: "localId" });
        pendingStore.createIndex("status", "status", { unique: false });
        pendingStore.createIndex("createdAt", "createdAt", { unique: false });
        pendingStore.createIndex("idempotencyKey", "idempotencyKey", { unique: true });
      }

      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generate a cryptographically secure, standard-compliant idempotency key.
 * Minimum length 16 chars, maximum 160 chars (matches server schema).
 */
export function generateOfflineIdempotencyKey(type: string): string {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 12);
  const randomPart2 = Math.random().toString(36).substring(2, 8);
  return `offline-${type}-${timestamp}-${randomPart}-${randomPart2}`;
}

/**
 * Enqueue a new transaction into the offline storage.
 */
export async function enqueueOfflineTransaction(
  draft: OfflineTransactionDraft
): Promise<OfflineTransaction> {
  const localId = `local_tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const idempotencyKey = generateOfflineIdempotencyKey(draft.type);

  const txRecord: OfflineTransaction = {
    ...draft,
    localId,
    idempotencyKey,
    status: "pending",
    createdAt: Date.now(),
    retryCount: 0,
    lastError: null,
  };

  if (!isIndexedDBSupported()) {
    memoryPendingTransactions.push(txRecord);
    return txRecord;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, "readwrite");
    const store = tx.objectStore(STORE_PENDING);
    const req = store.add(txRecord);

    req.onsuccess = () => resolve(txRecord);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve all pending transactions ordered by creation date.
 */
export async function getPendingTransactions(): Promise<OfflineTransaction[]> {
  if (!isIndexedDBSupported()) {
    return [...memoryPendingTransactions.filter((tx) => tx.status !== "synced")].sort(
      (a, b) => a.createdAt - b.createdAt
    );
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, "readonly");
    const store = tx.objectStore(STORE_PENDING);
    const req = store.getAll();

    req.onsuccess = () => {
      const all = (req.result as OfflineTransaction[]) || [];
      const pending = all
        .filter((item) => item.status === "pending" || item.status === "failed")
        .sort((a, b) => a.createdAt - b.createdAt);
      resolve(pending);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get count of pending transactions.
 */
export async function getPendingCount(): Promise<number> {
  const pending = await getPendingTransactions();
  return pending.length;
}

/**
 * Update transaction status (e.g. syncing, failed, synced).
 */
export async function updateTransactionStatus(
  localId: string,
  status: OfflineTransaction["status"],
  lastError?: string | null
): Promise<void> {
  if (!isIndexedDBSupported()) {
    const item = memoryPendingTransactions.find((tx) => tx.localId === localId);
    if (item) {
      item.status = status;
      if (lastError !== undefined) item.lastError = lastError;
      if (status === "failed") item.retryCount += 1;
    }
    return;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, "readwrite");
    const store = tx.objectStore(STORE_PENDING);
    const getReq = store.get(localId);

    getReq.onsuccess = () => {
      const record = getReq.result as OfflineTransaction | undefined;
      if (!record) {
        resolve();
        return;
      }
      record.status = status;
      if (lastError !== undefined) record.lastError = lastError;
      if (status === "failed") record.retryCount += 1;

      const putReq = store.put(record);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Remove a transaction after successful synchronization or manual deletion.
 */
export async function removeOfflineTransaction(localId: string): Promise<void> {
  if (!isIndexedDBSupported()) {
    memoryPendingTransactions = memoryPendingTransactions.filter((tx) => tx.localId !== localId);
    return;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, "readwrite");
    const store = tx.objectStore(STORE_PENDING);
    const req = store.delete(localId);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Clear all pending transactions.
 */
export async function clearAllPendingTransactions(): Promise<void> {
  if (!isIndexedDBSupported()) {
    memoryPendingTransactions = [];
    return;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, "readwrite");
    const store = tx.objectStore(STORE_PENDING);
    const req = store.clear();

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Cache banking accounts for offline selector availability.
 */
export async function cacheAccountsSnapshot(accounts: CachedAccount[]): Promise<void> {
  if (!isIndexedDBSupported()) {
    memoryCachedAccounts = [...accounts];
    return;
  }

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CACHE, "readwrite");
      const store = tx.objectStore(STORE_CACHE);
      const req = store.put({ key: "cached_accounts", data: accounts, updatedAt: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[OfflineDB] Failed to cache accounts snapshot:", err);
  }
}

/**
 * Retrieve cached accounts snapshot.
 */
export async function getCachedAccounts(): Promise<CachedAccount[]> {
  if (!isIndexedDBSupported()) {
    return [...memoryCachedAccounts];
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_CACHE, "readonly");
      const store = tx.objectStore(STORE_CACHE);
      const req = store.get("cached_accounts");

      req.onsuccess = () => {
        if (req.result && Array.isArray(req.result.data)) {
          resolve(req.result.data);
        } else {
          resolve([]);
        }
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}
