import { create } from "zustand";
import { DEFAULT_SETTINGS, DEFAULT_WATCHLIST } from "./config";
import { analyzeSymbol } from "./pipeline";
import { getHealthSnapshot, initHealth } from "./providers";
import {
  clearApiKeys,
  loadAlerts,
  loadSettings,
  loadSnapshots,
  loadWatchlist,
  saveAlerts,
  saveSettings,
  saveSnapshots,
  saveWatchlist,
} from "./storage";
import type { AlertRule, AnalysisResult, AppSettings, ProviderHealth, SavedSnapshot, WatchItem } from "./types";

interface QuantState {
  ready: boolean;
  settings: AppSettings;
  symbol: string;
  analysis: AnalysisResult | null;
  loading: boolean;
  error: string | null;
  watchlist: WatchItem[];
  scanner: AnalysisResult[];
  scanning: boolean;
  alerts: AlertRule[];
  snapshots: SavedSnapshot[];
  health: ProviderHealth[];
  lastFired: Record<string, number>;
  hydrate: () => void;
  setSymbol: (s: string) => void;
  patchSettings: (p: Partial<AppSettings>) => void;
  restoreDefaults: () => void;
  clearKeys: () => void;
  analyze: (symbol?: string) => Promise<AnalysisResult | null>;
  addWatch: (symbol: string) => void;
  removeWatch: (symbol: string) => void;
  runScanner: (symbols?: string[]) => Promise<void>;
  setAlerts: (rules: AlertRule[]) => void;
  saveSnap: () => void;
}

function applyTheme(theme: AppSettings["theme"]) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}

function fireAlerts(a: AnalysisResult, rules: AlertRule[], lastFired: Record<string, number>) {
  const now = Date.now();
  const fired = { ...lastFired };
  for (const r of rules) {
    if (!r.enabled) continue;
    const key = `${a.symbol}:${r.type}`;
    if (fired[key] && now - fired[key]! < 5 * 60_000) continue;
    let hit = false;
    if (r.type === "setup_score" && a.setupQuality >= r.threshold) hit = true;
    if (r.type === "rvol" && (a.keyIndicators.find((k) => k.name === "VOLUME")?.extras ? false : (a.bundles["15m"]?.relVolume ?? 0) >= r.threshold))
      hit = true;
    if (r.type === "adx" && (a.bundles["15m"]?.adx ?? a.bundles["1D"]?.adx ?? 0) >= r.threshold) hit = true;
    if (r.type === "breakout" && a.primarySetup.type.includes("BREAKOUT")) hit = true;
    if (r.type === "breakdown" && a.primarySetup.type.includes("BREAKDOWN")) hit = true;
    if (r.type === "vwap_cross") {
      const v = a.bundles["15m"]?.vwap ?? a.bundles["5m"]?.vwap;
      if (v && Math.abs(a.quote.price - v) / a.quote.price < 0.0015) hit = true;
    }
    if (r.type === "macd_cross" && a.primarySetup.reasons.some((x) => /MACD/i.test(x))) hit = true;
    if (r.type === "rsi_50") {
      const rsi = a.bundles["15m"]?.rsi14 ?? a.bundles["1D"]?.rsi14;
      if (rsi != null && Math.abs(rsi - 50) < 1.5) hit = true;
    }
    if (r.type === "support" && a.warnings.some((w) => w.code === "RES" || w.title.includes("SUPPORT"))) hit = true;
    if (r.type === "resistance" && a.warnings.some((w) => w.code === "RES")) hit = true;
    if (hit) {
      fired[key] = now;
      if (r.notify && typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(`Qwantize · ${a.symbol}`, { body: `${r.type.replaceAll("_", " ")} — setup ${a.setupQuality.toFixed(0)}` });
      }
    }
  }
  return fired;
}

export const useQuant = create<QuantState>((set, get) => ({
  ready: false,
  settings: DEFAULT_SETTINGS,
  symbol: "SPY",
  analysis: null,
  loading: false,
  error: null,
  watchlist: DEFAULT_WATCHLIST.map((symbol) => ({ symbol, addedAt: 0 })),
  scanner: [],
  scanning: false,
  alerts: [],
  snapshots: [],
  health: [],
  lastFired: {},
  hydrate: () => {
    const settings = loadSettings();
    applyTheme(settings.theme);
    initHealth({
      keys: settings.keys,
      enabled: settings.enabledProviders,
      priority: settings.providerPriority,
      allowPublicFeeds: settings.allowPublicFeeds,
    });
    set({
      ready: true,
      settings,
      watchlist: loadWatchlist(),
      alerts: loadAlerts(),
      snapshots: loadSnapshots(),
      health: getHealthSnapshot(),
    });
  },
  setSymbol: (s) => set({ symbol: s.trim().toUpperCase() }),
  patchSettings: (p) => {
    const settings = { ...get().settings, ...p };
    saveSettings(settings);
    applyTheme(settings.theme);
    set({ settings, health: getHealthSnapshot() });
  },
  restoreDefaults: () => {
    const settings = structuredClone(DEFAULT_SETTINGS);
    saveSettings(settings);
    applyTheme(settings.theme);
    set({ settings });
  },
  clearKeys: () => {
    const settings = clearApiKeys(get().settings);
    set({ settings });
  },
  analyze: async (symbol) => {
    const sym = (symbol ?? get().symbol).trim().toUpperCase();
    set({ loading: true, error: null, symbol: sym });
    try {
      const analysis = await analyzeSymbol(sym, get().settings);
      const lastFired = fireAlerts(analysis, get().alerts, get().lastFired);
      set({ analysis, loading: false, health: getHealthSnapshot(), lastFired });
      return analysis;
    } catch (e) {
      const error = e instanceof Error ? e.message : "Analysis failed";
      set({ loading: false, error });
      return null;
    }
  },
  addWatch: (symbol) => {
    const s = symbol.trim().toUpperCase();
    if (!s) return;
    const watchlist = [{ symbol: s, addedAt: Date.now() }, ...get().watchlist.filter((w) => w.symbol !== s)];
    saveWatchlist(watchlist);
    set({ watchlist });
  },
  removeWatch: (symbol) => {
    const watchlist = get().watchlist.filter((w) => w.symbol !== symbol);
    saveWatchlist(watchlist);
    set({ watchlist });
  },
  runScanner: async (symbols) => {
    const list = symbols?.map((s) => s.toUpperCase()) ?? get().watchlist.map((w) => w.symbol);
    set({ scanning: true, scanner: [] });
    const out: AnalysisResult[] = [];
    for (const s of list) {
      try {
        const a = await analyzeSymbol(s, get().settings);
        out.push(a);
        const lastFired = fireAlerts(a, get().alerts, get().lastFired);
        set({ scanner: [...out], lastFired, health: getHealthSnapshot() });
      } catch {
        /* skip symbol */
      }
    }
    set({ scanning: false });
  },
  setAlerts: (rules) => {
    saveAlerts(rules);
    set({ alerts: rules });
  },
  saveSnap: () => {
    const a = get().analysis;
    if (!a) return;
    const row: SavedSnapshot = {
      id: `${a.symbol}-${a.analyzedAt}`,
      symbol: a.symbol,
      timestamp: a.analyzedAt,
      price: a.quote.price,
      trendScore: a.trendScore,
      setupQuality: a.setupQuality,
      bias: a.bias,
      json: JSON.stringify(a),
    };
    const snapshots = [row, ...get().snapshots].slice(0, 40);
    saveSnapshots(snapshots);
    set({ snapshots });
  },
}));
