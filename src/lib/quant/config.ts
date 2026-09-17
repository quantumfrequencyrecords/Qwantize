import type { AppSettings, Timeframe } from "./types";

export const APP_NAME = "Qwantize";
export const APP_TAGLINE = "Ultimate Quant Trader";

export const DEFAULT_WATCHLIST = [
  "SPY",
  "QQQ",
  "IWM",
  "NVDA",
  "AAPL",
  "TSLA",
  "AMD",
  "MSFT",
  "META",
  "AMZN",
];

export const SCANNER_UNIVERSE = [
  ...DEFAULT_WATCHLIST,
  "GOOGL",
  "AVGO",
  "NFLX",
  "AMAT",
  "SMCI",
  "COIN",
  "PLTR",
  "CRM",
  "JPM",
  "XOM",
  "UNH",
  "COST",
  "BA",
  "DIS",
  "INTC",
];

export const DAY_TRADE_TFS: Timeframe[] = ["5m", "15m", "30m", "1h", "4h", "1D"];
export const ALL_TFS: Timeframe[] = [
  "1m",
  "2m",
  "3m",
  "5m",
  "10m",
  "15m",
  "30m",
  "45m",
  "1h",
  "2h",
  "4h",
  "1D",
  "1W",
  "1M",
];

export const DEFAULT_TF_WEIGHTS: Record<string, number> = {
  "1m": 0.05,
  "2m": 0.05,
  "3m": 0.07,
  "5m": 0.1,
  "10m": 0.12,
  "15m": 0.16,
  "30m": 0.22,
  "45m": 0.25,
  "1h": 0.3,
  "2h": 0.34,
  "4h": 0.4,
  "1D": 0.5,
  "1W": 0.35,
  "1M": 0.2,
};

export const SHORT_TFS: Timeframe[] = ["1m", "2m", "3m", "5m", "10m", "15m"];
export const HIGHER_TFS: Timeframe[] = ["30m", "45m", "1h", "2h", "4h", "1D", "1W"];

export const SECTOR_ETF: Record<string, string> = {
  AAPL: "XLK",
  MSFT: "XLK",
  NVDA: "XLK",
  AMD: "XLK",
  AVGO: "XLK",
  INTC: "XLK",
  AMAT: "XLK",
  SMCI: "XLK",
  PLTR: "XLK",
  META: "XLC",
  GOOGL: "XLC",
  NFLX: "XLC",
  DIS: "XLC",
  AMZN: "XLY",
  TSLA: "XLY",
  HD: "XLY",
  COST: "XLP",
  JPM: "XLF",
  GS: "XLF",
  V: "XLF",
  UNH: "XLV",
  JNJ: "XLV",
  XOM: "XLE",
  CVX: "XLE",
  BA: "XLI",
  CAT: "XLI",
  LIN: "XLB",
  NEE: "XLU",
  AMT: "XLRE",
  CRM: "XLK",
  COIN: "XLF",
};

export const PROVIDER_META = [
  { id: "yahoo", name: "Yahoo Finance", needsKey: false, rateLimit: "Unofficial / CORS-proxied" },
  { id: "stooq", name: "Stooq", needsKey: false, rateLimit: "Daily bars" },
  { id: "finnhub", name: "Finnhub", needsKey: true, rateLimit: "60/min free" },
  { id: "alphavantage", name: "Alpha Vantage", needsKey: true, rateLimit: "25/day free" },
  { id: "twelvedata", name: "Twelve Data", needsKey: true, rateLimit: "800/day free" },
  { id: "fmp", name: "Financial Modeling Prep", needsKey: true, rateLimit: "250/day free" },
  { id: "demo", name: "Demo (offline)", needsKey: false, rateLimit: "Always available" },
] as const;

export const DEFAULT_SETTINGS: AppSettings = {
  keys: {},
  enabledProviders: {
    yahoo: true,
    stooq: true,
    finnhub: true,
    alphavantage: true,
    twelvedata: true,
    fmp: true,
    demo: true,
  },
  providerPriority: ["finnhub", "twelvedata", "yahoo", "alphavantage", "fmp", "stooq", "demo"],
  timeframeWeights: { ...DEFAULT_TF_WEIGHTS },
  indicatorWeights: {
    trend: 0.2,
    momentum: 0.2,
    structure: 0.15,
    volume: 0.15,
    volatility: 0.1,
    levels: 0.1,
    market: 0.05,
    news: 0.05,
  },
  adxThresholds: { weak: 15, developing: 20, strong: 25, veryStrong: 35, extreme: 50 },
  signalDecayLambda: 0.08,
  mode: "day",
  uiMode: "beginner",
  theme: "dark",
  autoRefreshSec: 60,
  lookback: "5d",
  chartTimeframe: "15m",
  allowPublicFeeds: false,
};

export const KEY_STORAGE = "qwantize.settings.v1";
export const WATCH_STORAGE = "qwantize.watchlist.v1";
export const ALERT_STORAGE = "qwantize.alerts.v1";
export const SNAP_STORAGE = "qwantize.snapshots.v1";
export const HEALTH_STORAGE = "qwantize.health.v1";

export const API_KEY_WARNING =
  "API keys are stored locally in your browser. Keys used directly from the browser may be visible to network requests. Do not use a key with permissions beyond the data required by this application.";

export const DISCLAIMER =
  "Qwantize is a decision-support and quantitative-analysis tool. It does not guarantee outcomes, does not place trades, and is not financial advice. Scores describe technical alignment, not calibrated probability.";
