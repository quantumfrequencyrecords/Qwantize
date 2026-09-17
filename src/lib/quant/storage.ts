import { ALERT_STORAGE, DEFAULT_SETTINGS, KEY_STORAGE, SNAP_STORAGE, WATCH_STORAGE } from "./config";
import type { AlertRule, AppSettings, SavedSnapshot, WatchItem } from "./types";

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY_STORAGE);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...structuredClone(DEFAULT_SETTINGS),
      ...parsed,
      keys: { ...DEFAULT_SETTINGS.keys, ...(parsed.keys ?? {}) },
      enabledProviders: { ...DEFAULT_SETTINGS.enabledProviders, ...(parsed.enabledProviders ?? {}) },
      timeframeWeights: { ...DEFAULT_SETTINGS.timeframeWeights, ...(parsed.timeframeWeights ?? {}) },
      indicatorWeights: { ...DEFAULT_SETTINGS.indicatorWeights, ...(parsed.indicatorWeights ?? {}) },
      adxThresholds: { ...DEFAULT_SETTINGS.adxThresholds, ...(parsed.adxThresholds ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(s: AppSettings) {
  localStorage.setItem(KEY_STORAGE, JSON.stringify(s));
}

export function clearApiKeys(s: AppSettings): AppSettings {
  const next = { ...s, keys: {} };
  saveSettings(next);
  return next;
}

export function loadWatchlist(): WatchItem[] {
  try {
    const raw = localStorage.getItem(WATCH_STORAGE);
    if (!raw) return ["SPY", "QQQ", "NVDA", "TSLA", "AMD", "AAPL", "META", "AMZN"].map((symbol) => ({ symbol, addedAt: Date.now() }));
    return JSON.parse(raw) as WatchItem[];
  } catch {
    return [];
  }
}

export function saveWatchlist(items: WatchItem[]) {
  localStorage.setItem(WATCH_STORAGE, JSON.stringify(items));
}

export function loadAlerts(): AlertRule[] {
  try {
    const raw = localStorage.getItem(ALERT_STORAGE);
    if (!raw) {
      return [
        { id: "a1", enabled: true, type: "setup_score", threshold: 85, notify: true },
        { id: "a2", enabled: true, type: "rvol", threshold: 2, notify: true },
        { id: "a3", enabled: true, type: "vwap_cross", threshold: 0, notify: false },
        { id: "a4", enabled: false, type: "adx", threshold: 25, notify: true },
        { id: "a5", enabled: true, type: "breakout", threshold: 0, notify: true },
      ];
    }
    return JSON.parse(raw) as AlertRule[];
  } catch {
    return [];
  }
}

export function saveAlerts(rules: AlertRule[]) {
  localStorage.setItem(ALERT_STORAGE, JSON.stringify(rules));
}

export function loadSnapshots(): SavedSnapshot[] {
  try {
    return JSON.parse(localStorage.getItem(SNAP_STORAGE) || "[]") as SavedSnapshot[];
  } catch {
    return [];
  }
}

export function saveSnapshots(rows: SavedSnapshot[]) {
  localStorage.setItem(SNAP_STORAGE, JSON.stringify(rows.slice(0, 50)));
}

const DB_NAME = "QuantTraderDB";
const DB_VER = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of ["quotes", "candles", "news", "calculations", "watchlists", "settings", "providerHealth", "alerts"]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const q = tx.objectStore(store).get(key);
      q.onsuccess = () => resolve(q.result as T | undefined);
      q.onerror = () => reject(q.error);
    });
  } catch {
    return undefined;
  }
}

export async function idbSet(store: string, key: string, value: unknown): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* private mode / blocked */
  }
}

export interface CacheEntry<T> {
  savedAt: number;
  ttlMs: number;
  data: T;
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const row = await idbGet<CacheEntry<T>>("candles", key);
  if (!row) return undefined;
  if (Date.now() - row.savedAt > row.ttlMs) return undefined;
  return row.data;
}

export async function cacheSet<T>(key: string, data: T, ttlMs: number) {
  await idbSet("candles", key, { savedAt: Date.now(), ttlMs, data } satisfies CacheEntry<T>);
}
