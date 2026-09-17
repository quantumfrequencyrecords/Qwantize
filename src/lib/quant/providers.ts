import type { Candle, NewsItem, ProviderHealth, Quote, Timeframe } from "./types";
import { cacheGet, cacheSet } from "./storage";
import { getMarketSession } from "./marketHours";
import { mulberry32, resample, seedFrom } from "./math";
import { classifyNews } from "./news";

export interface ProviderContext {
  keys: Record<string, string>;
  enabled: Record<string, boolean>;
  priority: string[];
  allowPublicFeeds?: boolean;
}

const healthMap = new Map<string, ProviderHealth>();

export function getHealthSnapshot(): ProviderHealth[] {
  return [...healthMap.values()];
}

function touch(id: string, name: string, patch: Partial<ProviderHealth>) {
  const prev = healthMap.get(id) ?? {
    id,
    name,
    status: "idle",
    lastRequest: null,
    lastError: null,
    rateLimit: "—",
    healthScore: 80,
    enabled: true,
    needsKey: false,
    hasKey: false,
  };
  const next = { ...prev, ...patch, lastRequest: Date.now() };
  if (next.status === "failed") next.healthScore = Math.max(5, next.healthScore - 18);
  if (next.status === "online") next.healthScore = Math.min(100, next.healthScore + 8);
  if (next.status === "limited") next.healthScore = Math.max(20, next.healthScore - 6);
  healthMap.set(id, next);
}

const TF_MS: Record<Timeframe, number> = {
  "1m": 60_000,
  "2m": 120_000,
  "3m": 180_000,
  "5m": 300_000,
  "10m": 600_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "45m": 2_700_000,
  "1h": 3_600_000,
  "2h": 7_200_000,
  "4h": 14_400_000,
  "1D": 86_400_000,
  "1W": 604_800_000,
  "1M": 2_592_000_000,
};

export function yahooInterval(tf: Timeframe): { interval: string; range: string } {
  switch (tf) {
    case "1m":
      return { interval: "1m", range: "1d" };
    case "2m":
      return { interval: "2m", range: "5d" };
    case "5m":
      return { interval: "5m", range: "5d" };
    case "15m":
      return { interval: "15m", range: "1mo" };
    case "30m":
      return { interval: "30m", range: "1mo" };
    case "1h":
      return { interval: "60m", range: "3mo" };
    case "4h":
      return { interval: "60m", range: "6mo" };
    case "1W":
      return { interval: "1wk", range: "5y" };
    case "1M":
      return { interval: "1mo", range: "10y" };
    default:
      return { interval: "1d", range: "2y" };
  }
}

async function fetchText(url: string, timeout = 12000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function fetchJson(url: string, timeout = 12000): Promise<unknown> {
  const text = await fetchText(url, timeout);
  return JSON.parse(text);
}

const PROXIES = [
  (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
];

async function fetchJsonProxied(url: string): Promise<unknown> {
  let lastErr: unknown;
  for (const p of PROXIES) {
    try {
      return await fetchJson(p(url));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("All fetches failed");
}

function validCandles(rows: Candle[]): Candle[] {
  const out: Candle[] = [];
  let lastTs = 0;
  for (const c of rows) {
    if (!c || !Number.isFinite(c.close) || c.close <= 0) continue;
    if (!Number.isFinite(c.high) || !Number.isFinite(c.low) || !Number.isFinite(c.open)) continue;
    if (c.timestamp <= lastTs) continue;
    lastTs = c.timestamp;
    out.push({
      timestamp: c.timestamp,
      open: c.open,
      high: Math.max(c.high, c.open, c.close),
      low: Math.min(c.low, c.open, c.close),
      close: c.close,
      volume: Math.max(0, c.volume || 0),
    });
  }
  return out;
}

function qualityOf(rows: Candle[], expected = 50): number {
  if (!rows.length) return 10;
  let q = 70;
  if (rows.length >= expected) q += 10;
  else q -= Math.min(25, (expected - rows.length) * 0.4);
  const newest = rows[rows.length - 1]!.timestamp;
  const ageH = (Date.now() - newest) / 36e5;
  if (ageH < 1) q += 12;
  else if (ageH < 24) q += 6;
  else if (ageH > 72) q -= 20;
  const vols = rows.filter((c) => c.volume > 0).length / rows.length;
  q += vols * 8;
  return Math.max(8, Math.min(99, Math.round(q)));
}

const BASE_PX: Record<string, number> = {
  SPY: 562, QQQ: 489, IWM: 221, DIA: 425, VIX: 16.4,
  AAPL: 228, MSFT: 428, NVDA: 128, TSLA: 248, AMD: 162, META: 572,
  AMZN: 196, GOOGL: 174, NFLX: 748, AVGO: 178, INTC: 24, AMAT: 188,
  SMCI: 42, COIN: 212, PLTR: 38, CRM: 272, JPM: 218, XOM: 116,
  UNH: 312, COST: 912, BA: 186, DIS: 98, XLK: 232, XLF: 45, XLY: 208,
};

export function demoCandles(symbol: string, tf: Timeframe, count = 180): Candle[] {
  const rnd = mulberry32(seedFrom(symbol + tf));
  let px = BASE_PX[symbol.toUpperCase()] ?? 80 + (seedFrom(symbol) % 400);
  const step = TF_MS[tf];
  const now = Date.now();
  const start = now - count * step;
  const rows: Candle[] = [];
  let drift = (rnd() - 0.48) * 0.0015;
  for (let i = 0; i < count; i++) {
    const volShock = rnd() > 0.97 ? 2.2 : 1;
    const ret = drift + (rnd() - 0.5) * 0.012 * volShock;
    const open = px;
    const close = Math.max(0.5, open * (1 + ret));
    const high = Math.max(open, close) * (1 + rnd() * 0.006);
    const low = Math.min(open, close) * (1 - rnd() * 0.006);
    const volume = Math.round((0.4 + rnd()) * 2_400_000 * (tf === "1D" ? 8 : 1) * volShock);
    rows.push({ timestamp: start + i * step, open, high, low, close, volume });
    px = close;
    if (rnd() > 0.98) drift *= -0.6;
  }
  return rows;
}

function quoteFromCandles(symbol: string, rows: Candle[], provider: string, dq: number): Quote {
  const last = rows[rows.length - 1]!;
  const prev = rows[rows.length - 2] ?? last;
  const change = last.close - prev.close;
  return {
    symbol,
    price: last.close,
    open: last.open,
    high: last.high,
    low: last.low,
    previousClose: prev.close,
    change,
    changePercent: prev.close ? (change / prev.close) * 100 : 0,
    volume: last.volume,
    timestamp: last.timestamp,
    marketStatus: getMarketSession(),
    provider,
    dataQuality: dq,
  };
}

async function yahooOHLCV(symbol: string, tf: Timeframe): Promise<Candle[]> {
  const { interval, range } = yahooInterval(tf);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=true`;
  const json = (await fetchJsonProxied(url)) as {
    chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ open: number[]; high: number[]; low: number[]; close: number[]; volume: number[] }> } }> };
  };
  const r = json.chart?.result?.[0];
  const ts = r?.timestamp ?? [];
  const q = r?.indicators?.quote?.[0];
  if (!q || !ts.length) throw new Error("Yahoo empty");
  const rows: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    if (q.close[i] == null) continue;
    rows.push({
      timestamp: ts[i]! * 1000,
      open: q.open[i] ?? q.close[i]!,
      high: q.high[i] ?? q.close[i]!,
      low: q.low[i] ?? q.close[i]!,
      close: q.close[i]!,
      volume: q.volume[i] ?? 0,
    });
  }
  let out = validCandles(rows);
  if (tf === "4h") out = resample(out, TF_MS["4h"]);
  if (tf === "2h") out = resample(out, TF_MS["2h"]);
  if (tf === "10m") out = resample(out, TF_MS["10m"]);
  if (tf === "45m") out = resample(out, TF_MS["45m"]);
  if (tf === "3m") out = resample(out, TF_MS["3m"]);
  return out;
}

async function stooqOHLCV(symbol: string): Promise<Candle[]> {
  const s = symbol.toLowerCase().includes(".") ? symbol.toLowerCase() : `${symbol.toLowerCase()}.us`;
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(s)}&i=d`;
  const text = await fetchText(PROXIES[1]!(url)).catch(() => fetchText(url));
  const lines = text.trim().split(/\r?\n/).slice(1);
  const rows: Candle[] = [];
  for (const line of lines) {
    const [date, open, high, low, close, volume] = line.split(",");
    if (!date || close === "N/D") continue;
    rows.push({
      timestamp: new Date(date).getTime(),
      open: +open!,
      high: +high!,
      low: +low!,
      close: +close!,
      volume: +(volume || 0),
    });
  }
  return validCandles(rows).slice(-400);
}

async function finnhubOHLCV(symbol: string, tf: Timeframe, key: string): Promise<Candle[]> {
  const map: Partial<Record<Timeframe, string>> = {
    "1m": "1",
    "5m": "5",
    "15m": "15",
    "30m": "30",
    "1h": "60",
    "1D": "D",
    "1W": "W",
    "1M": "M",
  };
  const res = map[tf] ?? (tf === "4h" ? "60" : "D");
  const now = Math.floor(Date.now() / 1000);
  const from = now - (tf === "1D" || tf === "1W" || tf === "1M" ? 86400 * 400 : 86400 * 15);
  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${res}&from=${from}&to=${now}&token=${encodeURIComponent(key)}`;
  const json = (await fetchJson(url)) as { s?: string; t?: number[]; o?: number[]; h?: number[]; l?: number[]; c?: number[]; v?: number[] };
  if (json.s !== "ok" || !json.t) throw new Error("Finnhub candle fail");
  let rows = json.t.map((t, i) => ({
    timestamp: t * 1000,
    open: json.o![i]!,
    high: json.h![i]!,
    low: json.l![i]!,
    close: json.c![i]!,
    volume: json.v![i]!,
  }));
  rows = validCandles(rows);
  if (tf === "4h") rows = resample(rows, TF_MS["4h"]);
  return rows;
}

async function alphaOHLCV(symbol: string, tf: Timeframe, key: string): Promise<Candle[]> {
  const isDaily = tf === "1D" || tf === "1W" || tf === "1M";
  const fn = isDaily ? "TIME_SERIES_DAILY" : "TIME_SERIES_INTRADAY";
  const interval = tf === "1h" || tf === "4h" || tf === "2h" ? "60min" : tf === "30m" ? "30min" : tf === "15m" ? "15min" : "5min";
  const url = `https://www.alphavantage.co/query?function=${fn}&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}&outputsize=compact${isDaily ? "" : `&interval=${interval}`}`;
  const json = (await fetchJson(url)) as Record<string, Record<string, Record<string, string>>>;
  const seriesKey = Object.keys(json).find((k) => k.includes("Time Series"));
  if (!seriesKey) throw new Error(json["Note"] ? "Alpha Vantage rate limit" : "Alpha Vantage empty");
  const series = json[seriesKey]!;
  let rows: Candle[] = Object.entries(series)
    .map(([k, v]) => ({
      timestamp: new Date(k).getTime(),
      open: +v["1. open"]!,
      high: +v["2. high"]!,
      low: +v["3. low"]!,
      close: +v["4. close"]!,
      volume: +v["5. volume"]!,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
  rows = validCandles(rows);
  if (tf === "4h") rows = resample(rows, TF_MS["4h"]);
  return rows;
}

async function twelveOHLCV(symbol: string, tf: Timeframe, key: string): Promise<Candle[]> {
  const map: Partial<Record<Timeframe, string>> = {
    "1m": "1min",
    "5m": "5min",
    "15m": "15min",
    "30m": "30min",
    "1h": "1h",
    "2h": "2h",
    "4h": "4h",
    "1D": "1day",
    "1W": "1week",
    "1M": "1month",
  };
  const interval = map[tf] ?? "1day";
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=180&apikey=${encodeURIComponent(key)}`;
  const json = (await fetchJson(url)) as { values?: Array<{ datetime: string; open: string; high: string; low: string; close: string; volume: string }>; status?: string; message?: string };
  if (!json.values) throw new Error(json.message || "Twelve Data empty");
  return validCandles(
    json.values
      .map((v) => ({
        timestamp: new Date(v.datetime).getTime(),
        open: +v.open,
        high: +v.high,
        low: +v.low,
        close: +v.close,
        volume: +v.volume,
      }))
      .reverse(),
  );
}

async function fmpOHLCV(symbol: string, tf: Timeframe, key: string): Promise<Candle[]> {
  const isIntra = !["1D", "1W", "1M"].includes(tf);
  const url = isIntra
    ? `https://financialmodelingprep.com/api/v3/historical-chart/15min/${encodeURIComponent(symbol)}?apikey=${encodeURIComponent(key)}`
    : `https://financialmodelingprep.com/api/v3/historical-price-full/${encodeURIComponent(symbol)}?timeseries=180&apikey=${encodeURIComponent(key)}`;
  const json = (await fetchJson(url)) as
    | Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>
    | { historical?: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }> };
  const rows = Array.isArray(json) ? json : json.historical ?? [];
  let out = validCandles(
    rows
      .map((v) => ({
        timestamp: new Date(v.date).getTime(),
        open: v.open,
        high: v.high,
        low: v.low,
        close: v.close,
        volume: v.volume,
      }))
      .sort((a, b) => a.timestamp - b.timestamp),
  );
  if (tf === "4h" && isIntra) out = resample(out, TF_MS["4h"]);
  return out;
}

type FetchFn = (symbol: string, tf: Timeframe, key?: string) => Promise<Candle[]>;

const PROVIDERS: { id: string; name: string; needsKey: boolean; dailyOnly?: boolean; run: FetchFn }[] = [
  { id: "finnhub", name: "Finnhub", needsKey: true, run: (s, tf, k) => finnhubOHLCV(s, tf, k!) },
  { id: "twelvedata", name: "Twelve Data", needsKey: true, run: (s, tf, k) => twelveOHLCV(s, tf, k!) },
  { id: "yahoo", name: "Yahoo Finance", needsKey: false, run: (s, tf) => yahooOHLCV(s, tf) },
  { id: "alphavantage", name: "Alpha Vantage", needsKey: true, run: (s, tf, k) => alphaOHLCV(s, tf, k!) },
  { id: "fmp", name: "Financial Modeling Prep", needsKey: true, run: (s, tf, k) => fmpOHLCV(s, tf, k!) },
  { id: "stooq", name: "Stooq", needsKey: false, dailyOnly: true, run: (s) => stooqOHLCV(s) },
];

export async function fetchOHLCV(symbol: string, tf: Timeframe, ctx: ProviderContext): Promise<{ candles: Candle[]; provider: string; quality: number; trail: string[] }> {
  const cacheKey = `${symbol}:${tf}`;
  const cached = await cacheGet<{ candles: Candle[]; provider: string; quality: number }>(cacheKey);
  if (cached?.candles?.length) return { ...cached, trail: [`cache:${cached.provider}`] };

  const trail: string[] = [];
  const order = [...ctx.priority].sort((a, b) => {
    const ha = healthMap.get(a)?.healthScore ?? 80;
    const hb = healthMap.get(b)?.healthScore ?? 80;
    return hb - ha || ctx.priority.indexOf(a) - ctx.priority.indexOf(b);
  });

  for (const id of order) {
    if (ctx.enabled[id] === false) continue;
    const spec = PROVIDERS.find((p) => p.id === id);
    if (!spec) continue;
    if (spec.dailyOnly && !["1D", "1W", "1M"].includes(tf)) continue;
    const key = ctx.keys[id];
    if (spec.needsKey && !key) continue;
    if ((id === "yahoo" || id === "stooq") && !ctx.allowPublicFeeds) continue;
    try {
      const candles = await spec.run(symbol, tf, key);
      if (candles.length < 15) throw new Error("incomplete");
      const quality = qualityOf(candles);
      touch(id, spec.name, { status: "online", lastError: null, hasKey: Boolean(key), needsKey: spec.needsKey, enabled: true });
      trail.push(`${id}:ok`);
      const payload = { candles, provider: spec.name, quality };
      await cacheSet(cacheKey, payload, tf === "1m" || tf === "5m" ? 20_000 : 60_000);
      return { ...payload, trail };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error";
      trail.push(`${id}:${msg}`);
      const limited = /rate|limit|Note|429/i.test(msg);
      touch(id, spec.name, {
        status: limited ? "limited" : "failed",
        lastError: msg,
        hasKey: Boolean(key),
        needsKey: spec.needsKey,
        enabled: true,
      });
    }
  }

  const candles = demoCandles(symbol, tf);
  trail.push("demo:fallback");
  touch("demo", "Demo (offline)", { status: "online", lastError: null, enabled: true });
  return { candles, provider: "Demo", quality: 38, trail };
}

export async function fetchQuote(symbol: string, ctx: ProviderContext): Promise<Quote> {
  const { candles, provider, quality } = await fetchOHLCV(symbol, "1D", ctx);
  const q = quoteFromCandles(symbol, candles, provider, quality);
  if (ctx.keys.finnhub) {
    try {
      const json = (await fetchJson(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(ctx.keys.finnhub)}`,
      )) as { c?: number; d?: number; dp?: number; h?: number; l?: number; o?: number; pc?: number; t?: number };
      if (json.c) {
        return {
          ...q,
          price: json.c,
          change: json.d ?? q.change,
          changePercent: json.dp ?? q.changePercent,
          open: json.o ?? q.open,
          high: json.h ?? q.high,
          low: json.l ?? q.low,
          previousClose: json.pc ?? q.previousClose,
          timestamp: json.t ? json.t * 1000 : Date.now(),
          provider: "Finnhub",
          dataQuality: Math.max(quality, 90),
        };
      }
    } catch {
      /* keep ohlcv quote */
    }
  }
  return q;
}

export async function fetchNews(symbol: string, ctx: ProviderContext): Promise<NewsItem[]> {
  if (ctx.keys.finnhub) {
    try {
      const to = new Date().toISOString().slice(0, 10);
      const fromD = new Date(Date.now() - 86400 * 7 * 1000).toISOString().slice(0, 10);
      const json = (await fetchJson(
        `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fromD}&to=${to}&token=${encodeURIComponent(ctx.keys.finnhub)}`,
      )) as Array<{ id?: number; headline: string; source: string; datetime: number; url: string; summary?: string }>;
      if (Array.isArray(json) && json.length) {
        return json.slice(0, 18).map((n, i) => classifyNews({
          id: String(n.id ?? i),
          headline: n.headline,
          source: n.source,
          timestamp: n.datetime * 1000,
          url: n.url,
          summary: n.summary,
        }));
      }
    } catch {
      /* fall through */
    }
  }
  if (!ctx.allowPublicFeeds) return demoNews(symbol);
  try {
    const rss = `https://news.google.com/rss/search?q=${encodeURIComponent(symbol + " stock")}&hl=en-US&gl=US&ceid=US:en`;
    const xml = await fetchText(PROXIES[1]!(rss)).catch(() => "");
    const items = [...xml.matchAll(/<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<source[^>]*>([\s\S]*?)<\/source>/g)];
    return items.slice(0, 12).map((m, i) =>
      classifyNews({
        id: `g${i}`,
        headline: decodeXml(m[1] ?? ""),
        source: decodeXml(m[4] ?? "Google News"),
        timestamp: new Date(m[3] ?? Date.now()).getTime(),
        url: (m[2] ?? "").trim(),
      }),
    );
  } catch {
    return demoNews(symbol);
  }
}

function decodeXml(s: string) {
  return s.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, '"').replace(/&#39;/g, "'");
}

function demoNews(symbol: string): NewsItem[] {
  const headlines = [
    `${symbol} holds near session value as traders watch volume confirmation`,
    `Analysts debate near-term range for ${symbol} into the next session`,
    `Market breadth mixed while ${symbol} tracks mega-cap leadership`,
  ];
  return headlines.map((headline, i) =>
    classifyNews({
      id: `d${i}`,
      headline,
      source: "Qwantize Wire",
      timestamp: Date.now() - (i + 1) * 36e5,
      url: "https://finance.yahoo.com",
    }),
  );
}

export function initHealth(ctx: ProviderContext) {
  for (const p of PROVIDERS) {
    if (!healthMap.has(p.id)) {
      healthMap.set(p.id, {
        id: p.id,
        name: p.name,
        status: ctx.enabled[p.id] === false ? "disabled" : "idle",
        lastRequest: null,
        lastError: null,
        rateLimit: p.needsKey ? "Keyed free tier" : "No key",
        healthScore: 80,
        enabled: ctx.enabled[p.id] !== false,
        needsKey: p.needsKey,
        hasKey: Boolean(ctx.keys[p.id]),
      });
    }
  }
  if (!healthMap.has("demo")) {
    healthMap.set("demo", {
      id: "demo",
      name: "Demo (offline)",
      status: "idle",
      lastRequest: null,
      lastError: null,
      rateLimit: "Unlimited synthetic",
      healthScore: 60,
      enabled: true,
      needsKey: false,
      hasKey: false,
    });
  }
}
