export type Timeframe =
  | "1m"
  | "2m"
  | "3m"
  | "5m"
  | "10m"
  | "15m"
  | "30m"
  | "45m"
  | "1h"
  | "2h"
  | "4h"
  | "1D"
  | "1W"
  | "1M";

export type Lookback =
  | "today"
  | "5d"
  | "1mo"
  | "3mo"
  | "6mo"
  | "ytd"
  | "1y"
  | "3y"
  | "5y";

export type Signal = "BULLISH" | "BEARISH" | "NEUTRAL" | "WARNING";

export type BiasLabel =
  | "EXTREMELY_BULLISH"
  | "STRONG_BULLISH"
  | "BULLISH"
  | "SLIGHT_BULLISH"
  | "NEUTRAL"
  | "SLIGHT_BEARISH"
  | "BEARISH"
  | "STRONG_BEARISH"
  | "EXTREMELY_BEARISH";

export type SetupGrade = "A+" | "A" | "B" | "C" | "LOW";

export type MarketSession = "PREMARKET" | "OPEN" | "AFTERHOURS" | "CLOSED" | "WEEKEND" | "HOLIDAY";

export type TradingMode = "day" | "swing" | "position";
export type UiMode = "beginner" | "advanced";
export type ThemeMode = "dark" | "light";

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Quote {
  symbol: string;
  price: number;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: number;
  marketStatus: MarketSession;
  provider: string;
  dataQuality: number;
  name?: string;
}

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  timestamp: number;
  url: string;
  sentiment: Signal;
  relevance: number;
  impact: "high" | "medium" | "low";
  category: string;
  summary?: string;
}

export interface IndicatorReading {
  name: string;
  timeframe: Timeframe;
  value: number | string;
  signal: Signal;
  score: number;
  confidence: number;
  trend: "RISING" | "FALLING" | "FLAT";
  freshness: number;
  explanation: string;
  extras?: Record<string, number | string | boolean | null>;
}

export interface MaSnapshot {
  sma20: number | null;
  sma50: number | null;
  sma100: number | null;
  sma200: number | null;
  ema9: number | null;
  ema20: number | null;
  ema21: number | null;
  ema50: number | null;
  ema100: number | null;
  ema200: number | null;
  priceVsEma9Pct: number | null;
  priceVsEma20Pct: number | null;
  priceVsSma20Pct: number | null;
  priceVsSma50Pct: number | null;
  priceVsSma200Pct: number | null;
  ema9Slope: number | null;
  ema20Slope: number | null;
  goldenCross: boolean;
  deathCross: boolean;
  structure: Signal;
}

export interface IndicatorBundle {
  timeframe: Timeframe;
  ma: MaSnapshot;
  rsi7: number | null;
  rsi14: number | null;
  rsi21: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  adx: number | null;
  plusDi: number | null;
  minusDi: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  bbWidth: number | null;
  percentB: number | null;
  vwap: number | null;
  vwapDevPct: number | null;
  atr: number | null;
  atrPct: number | null;
  stochK: number | null;
  stochD: number | null;
  cci: number | null;
  roc: number | null;
  momentum: number | null;
  relVolume: number | null;
  volumeSma: number | null;
  readings: IndicatorReading[];
}

export interface SrLevel {
  price: number;
  kind: "support" | "resistance" | "pivot" | "dynamic";
  label: string;
  score: number;
  sources: string[];
  low: number;
  high: number;
}

export interface SetupPlan {
  type: string;
  direction: "LONG" | "SHORT" | "NONE";
  quality: number;
  grade: SetupGrade;
  entryLow: number | null;
  entryHigh: number | null;
  stop: number | null;
  targets: { label: string; price: number; rr: number | null }[];
  reasons: string[];
  risks: string[];
  checklist: { label: string; ok: boolean }[];
  noTrade: boolean;
  noTradeReason?: string;
}

export interface CategoryScore {
  key: string;
  label: string;
  weight: number;
  raw: number;
  awarded: number;
  max: number;
  explanation: string;
}

export interface TimeframeBias {
  timeframe: Timeframe;
  bias: Signal;
  score: number;
  available: boolean;
}

export interface WarningItem {
  code: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
}

export interface AnalysisResult {
  symbol: string;
  quote: Quote;
  analyzedAt: number;
  lookback: Lookback;
  mode: TradingMode;
  dataQuality: number;
  providerTrail: string[];
  bias: BiasLabel;
  trendScore: number;
  confidence: number;
  setupQuality: number;
  grade: SetupGrade;
  dayTradeBias: "LONG" | "SHORT" | "NONE";
  status: string;
  alignment: number;
  mtf: TimeframeBias[];
  conflict: {
    present: boolean;
    shortTerm: Signal;
    higherTf: Signal;
    interpretation: string;
  };
  categories: CategoryScore[];
  keyIndicators: IndicatorReading[];
  bundles: Partial<Record<Timeframe, IndicatorBundle>>;
  candles: Partial<Record<Timeframe, Candle[]>>;
  levels: SrLevel[];
  setups: SetupPlan[];
  primarySetup: SetupPlan;
  news: NewsItem[];
  newsSentiment: { bullish: number; bearish: number; neutral: number; overall: Signal; freshness: number };
  marketContext: {
    spyBias: Signal;
    qqqBias: Signal;
    iwmBias: Signal;
    vix?: number | null;
    relativeVsSpy: number | null;
    relativeVsSector: number | null;
    sector?: string | null;
    label: string;
  };
  regime: string;
  expectedMove: { value: number; pct: number; source: "historical-volatility" | "atr" };
  gap: { pct: number; kind: string; fillStatus: string };
  openingRange?: {
    or5?: { high: number; low: number };
    or15?: { high: number; low: number };
    or30?: { high: number; low: number };
  };
  warnings: WarningItem[];
  explainability: string[];
  usedDemo: boolean;
}

export interface ProviderHealth {
  id: string;
  name: string;
  status: "online" | "limited" | "failed" | "disabled" | "idle";
  lastRequest: number | null;
  lastError: string | null;
  rateLimit: string;
  healthScore: number;
  enabled: boolean;
  needsKey: boolean;
  hasKey: boolean;
}

export interface WatchItem {
  symbol: string;
  addedAt: number;
}

export interface AlertRule {
  id: string;
  enabled: boolean;
  type:
    | "setup_score"
    | "breakout"
    | "breakdown"
    | "rvol"
    | "vwap_cross"
    | "macd_cross"
    | "rsi_50"
    | "adx"
    | "support"
    | "resistance";
  threshold: number;
  notify: boolean;
}

export interface SavedSnapshot {
  id: string;
  symbol: string;
  timestamp: number;
  price: number;
  trendScore: number;
  setupQuality: number;
  bias: BiasLabel;
  json: string;
}

export interface AppSettings {
  keys: Record<string, string>;
  enabledProviders: Record<string, boolean>;
  providerPriority: string[];
  timeframeWeights: Record<string, number>;
  indicatorWeights: {
    trend: number;
    momentum: number;
    structure: number;
    volume: number;
    volatility: number;
    levels: number;
    market: number;
    news: number;
  };
  adxThresholds: { weak: number; developing: number; strong: number; veryStrong: number; extreme: number };
  signalDecayLambda: number;
  mode: TradingMode;
  uiMode: UiMode;
  theme: ThemeMode;
  autoRefreshSec: number;
  lookback: Lookback;
  chartTimeframe: Timeframe;
  allowPublicFeeds: boolean;
}
