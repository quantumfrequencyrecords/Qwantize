import type { Candle, IndicatorBundle, IndicatorReading, MaSnapshot, Signal, Timeframe } from "./types";
import { ema, last, linRegSlope, mean, pctChange, sma, stdev } from "./math";

function closes(c: Candle[]) {
  return c.map((x) => x.close);
}
function highs(c: Candle[]) {
  return c.map((x) => x.high);
}
function lows(c: Candle[]) {
  return c.map((x) => x.low);
}

export function rsiWilder(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i]! - values[i - 1]!;
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgG = gain / period;
  let avgL = loss / period;
  out[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i]! - values[i - 1]!;
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgG = (avgG * (period - 1) + g) / period;
    avgL = (avgL * (period - 1) + l) / period;
    out[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }
  return out;
}

export function macdCalc(values: number[], fast = 12, slow = 26, signal = 9) {
  const emaF = ema(values, fast);
  const emaS = ema(values, slow);
  const line: (number | null)[] = values.map((_, i) =>
    emaF[i] != null && emaS[i] != null ? emaF[i]! - emaS[i]! : null,
  );
  const compact = line.map((v) => v ?? 0);
  const start = line.findIndex((v) => v != null);
  const sigSeries = ema(compact.slice(Math.max(0, start)), signal);
  const signalLine: (number | null)[] = Array(values.length).fill(null);
  const hist: (number | null)[] = Array(values.length).fill(null);
  for (let i = 0; i < sigSeries.length; i++) {
    const idx = i + Math.max(0, start);
    if (idx >= values.length) break;
    const s = sigSeries[i];
    const l = line[idx];
    if (s != null && l != null) {
      signalLine[idx] = s;
      hist[idx] = l - s;
    }
  }
  return { line, signal: signalLine, hist };
}

export function atrWilder(c: Candle[], period = 14): (number | null)[] {
  const tr: number[] = c.map((bar, i) => {
    if (i === 0) return bar.high - bar.low;
    const prev = c[i - 1]!.close;
    return Math.max(bar.high - bar.low, Math.abs(bar.high - prev), Math.abs(bar.low - prev));
  });
  const out: (number | null)[] = Array(c.length).fill(null);
  if (c.length < period) return out;
  let atr = mean(tr.slice(0, period));
  out[period - 1] = atr;
  for (let i = period; i < c.length; i++) {
    atr = (atr * (period - 1) + tr[i]!) / period;
    out[i] = atr;
  }
  return out;
}

export function adxCalc(c: Candle[], period = 14) {
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];
  const tr: number[] = [c[0] ? c[0].high - c[0].low : 0];
  for (let i = 1; i < c.length; i++) {
    const up = c[i]!.high - c[i - 1]!.high;
    const down = c[i - 1]!.low - c[i]!.low;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
    const prev = c[i - 1]!.close;
    tr.push(Math.max(c[i]!.high - c[i]!.low, Math.abs(c[i]!.high - prev), Math.abs(c[i]!.low - prev)));
  }
  const smooth = (arr: number[]) => {
    const out: (number | null)[] = Array(arr.length).fill(null);
    if (arr.length < period) return out;
    let s = mean(arr.slice(1, period + 1));
    out[period] = s;
    for (let i = period + 1; i < arr.length; i++) {
      s = s - s / period + arr[i]!;
      out[i] = s;
    }
    return out;
  };
  const sTR = smooth(tr);
  const sP = smooth(plusDM);
  const sM = smooth(minusDM);
  const plusDI: (number | null)[] = Array(c.length).fill(null);
  const minusDI: (number | null)[] = Array(c.length).fill(null);
  const dx: (number | null)[] = Array(c.length).fill(null);
  for (let i = 0; i < c.length; i++) {
    if (sTR[i] && sP[i] != null && sM[i] != null) {
      plusDI[i] = (100 * sP[i]!) / sTR[i]!;
      minusDI[i] = (100 * sM[i]!) / sTR[i]!;
      const den = plusDI[i]! + minusDI[i]!;
      dx[i] = den === 0 ? 0 : (100 * Math.abs(plusDI[i]! - minusDI[i]!)) / den;
    }
  }
  const adx = ema(
    dx.map((v) => v ?? 0),
    period,
  );
  return { adx, plusDI, minusDI };
}

export function bollinger(values: number[], period = 20, mult = 2) {
  const mid = sma(values, period);
  const upper: (number | null)[] = Array(values.length).fill(null);
  const lower: (number | null)[] = Array(values.length).fill(null);
  const width: (number | null)[] = Array(values.length).fill(null);
  const pctB: (number | null)[] = Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const sd = stdev(slice);
    const m = mid[i]!;
    upper[i] = m + mult * sd;
    lower[i] = m - mult * sd;
    width[i] = m ? (upper[i]! - lower[i]!) / m : 0;
    const rng = upper[i]! - lower[i]!;
    pctB[i] = rng ? (values[i]! - lower[i]!) / rng : 0.5;
  }
  return { mid, upper, lower, width, pctB };
}

export function sessionVwap(c: Candle[]): (number | null)[] {
  const out: (number | null)[] = Array(c.length).fill(null);
  if (!c.length) return out;
  const dayKey = (ts: number) => {
    const d = new Date(ts);
    const et = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
    return `${et.getFullYear()}-${et.getMonth()}-${et.getDate()}`;
  };
  let pv = 0;
  let vol = 0;
  let key = dayKey(c[0]!.timestamp);
  for (let i = 0; i < c.length; i++) {
    const k = dayKey(c[i]!.timestamp);
    if (k !== key) {
      pv = 0;
      vol = 0;
      key = k;
    }
    const tp = (c[i]!.high + c[i]!.low + c[i]!.close) / 3;
    pv += tp * c[i]!.volume;
    vol += c[i]!.volume;
    out[i] = vol ? pv / vol : tp;
  }
  return out;
}

export function stochastic(c: Candle[], kPeriod = 14, dPeriod = 3) {
  const k: (number | null)[] = Array(c.length).fill(null);
  for (let i = kPeriod - 1; i < c.length; i++) {
    const slice = c.slice(i - kPeriod + 1, i + 1);
    const hh = Math.max(...slice.map((x) => x.high));
    const ll = Math.min(...slice.map((x) => x.low));
    k[i] = hh === ll ? 50 : ((c[i]!.close - ll) / (hh - ll)) * 100;
  }
  const compact = k.map((v) => v ?? 0);
  const d = sma(compact, dPeriod);
  return { k, d };
}

export function cciCalc(c: Candle[], period = 20): (number | null)[] {
  const tp = c.map((x) => (x.high + x.low + x.close) / 3);
  const sm = sma(tp, period);
  const out: (number | null)[] = Array(c.length).fill(null);
  for (let i = period - 1; i < c.length; i++) {
    const slice = tp.slice(i - period + 1, i + 1);
    const m = sm[i]!;
    const md = mean(slice.map((v) => Math.abs(v - m)));
    out[i] = md === 0 ? 0 : (tp[i]! - m) / (0.015 * md);
  }
  return out;
}

export function rocCalc(values: number[], period = 12): (number | null)[] {
  return values.map((v, i) => (i < period || !values[i - period] ? null : pctChange(values[i - period]!, v)));
}

export function relativeVolume(c: Candle[], avgPeriod = 20): number | null {
  if (c.length < 5) return null;
  const vols = c.map((x) => x.volume);
  const avg = mean(vols.slice(Math.max(0, vols.length - avgPeriod - 1), vols.length - 1));
  const cur = last(vols) ?? 0;
  if (!avg) return null;
  return cur / avg;
}

export function timeOfDayRvol(c: Candle[], sessionsBack = 8): number | null {
  if (c.length < 30) return relativeVolume(c);
  const lastBar = c[c.length - 1]!;
  const tod = new Date(lastBar.timestamp).getMinutes() + new Date(lastBar.timestamp).getHours() * 60;
  const comparable: number[] = [];
  for (let i = 0; i < c.length - 1; i++) {
    const d = new Date(c[i]!.timestamp);
    const m = d.getHours() * 60 + d.getMinutes();
    if (Math.abs(m - tod) <= 2) comparable.push(c[i]!.volume);
  }
  const sample = comparable.slice(-sessionsBack);
  if (sample.length < 3) return relativeVolume(c);
  const avg = mean(sample);
  return avg ? lastBar.volume / avg : null;
}

function dirFrom(n: number | null, up: number, down: number): Signal {
  if (n == null) return "NEUTRAL";
  if (n >= up) return "BULLISH";
  if (n <= down) return "BEARISH";
  return "NEUTRAL";
}

function reading(
  name: string,
  tf: Timeframe,
  value: number | string,
  signal: Signal,
  score: number,
  explanation: string,
  extras?: IndicatorReading["extras"],
): IndicatorReading {
  return {
    name,
    timeframe: tf,
    value,
    signal,
    score,
    confidence: Math.min(0.95, 0.55 + Math.abs(score) / 250),
    trend: score > 8 ? "RISING" : score < -8 ? "FALLING" : "FLAT",
    freshness: 0.92,
    explanation,
    extras,
  };
}

export function computeBundle(tf: Timeframe, candles: Candle[]): IndicatorBundle | null {
  if (candles.length < 25) return null;
  const c = candles;
  const px = closes(c);
  const price = last(px)!;
  const ema9s = ema(px, 9);
  const ema20s = ema(px, 20);
  const ema21s = ema(px, 21);
  const ema50s = ema(px, 50);
  const ema100s = ema(px, 100);
  const ema200s = ema(px, 200);
  const sma20s = sma(px, 20);
  const sma50s = sma(px, 50);
  const sma100s = sma(px, 100);
  const sma200s = sma(px, 200);
  const e9 = last(ema9s.filter((v) => v != null)) as number | undefined;
  const e20 = last(ema20s.filter((v) => v != null)) as number | undefined;
  const e50 = last(ema50s.filter((v) => v != null)) as number | undefined;
  const e200 = last(ema200s.filter((v) => v != null)) as number | undefined;
  const s50 = last(sma50s.filter((v) => v != null)) as number | undefined;
  const s200 = last(sma200s.filter((v) => v != null)) as number | undefined;
  const golden = e50 != null && e200 != null && e50 > e200;
  const death = e50 != null && e200 != null && e50 < e200;
  let structure: Signal = "NEUTRAL";
  if (e9 != null && e20 != null && e50 != null) {
    if (price > e9 && e9 > e20 && e20 > e50) structure = "BULLISH";
    else if (price < e9 && e9 < e20 && e20 < e50) structure = "BEARISH";
  }
  const ma: MaSnapshot = {
    sma20: last(sma20s.filter((v) => v != null)) ?? null,
    sma50: s50 ?? null,
    sma100: last(sma100s.filter((v) => v != null)) ?? null,
    sma200: s200 ?? null,
    ema9: e9 ?? null,
    ema20: e20 ?? null,
    ema21: last(ema21s.filter((v) => v != null)) ?? null,
    ema50: e50 ?? null,
    ema100: last(ema100s.filter((v) => v != null)) ?? null,
    ema200: e200 ?? null,
    priceVsEma9Pct: e9 ? pctChange(e9, price) : null,
    priceVsEma20Pct: e20 ? pctChange(e20, price) : null,
    priceVsSma20Pct: maNum(sma20s, price),
    priceVsSma50Pct: s50 ? pctChange(s50, price) : null,
    priceVsSma200Pct: s200 ? pctChange(s200, price) : null,
    ema9Slope: slopeLast(ema9s),
    ema20Slope: slopeLast(ema20s),
    goldenCross: Boolean(golden && s50 != null && s200 != null && s50 > s200),
    deathCross: Boolean(death),
    structure,
  };
  const r7 = rsiWilder(px, 7);
  const r14 = rsiWilder(px, 14);
  const r21 = rsiWilder(px, 21);
  const macd = macdCalc(px);
  const adx = adxCalc(c);
  const bb = bollinger(px);
  const vwap = sessionVwap(c);
  const atr = atrWilder(c);
  const st = stochastic(c);
  const cci = cciCalc(c);
  const roc = rocCalc(px, 12);
  const rsi = last(r14.filter((v) => v != null)) as number | undefined;
  const macdL = last(macd.line.filter((v) => v != null)) as number | undefined;
  const macdS = last(macd.signal.filter((v) => v != null)) as number | undefined;
  const macdH = last(macd.hist.filter((v) => v != null)) as number | undefined;
  const adxV = last(adx.adx.filter((v) => v != null)) as number | undefined;
  const pdi = last(adx.plusDI.filter((v) => v != null)) as number | undefined;
  const mdi = last(adx.minusDI.filter((v) => v != null)) as number | undefined;
  const vwapV = last(vwap.filter((v) => v != null)) as number | undefined;
  const atrV = last(atr.filter((v) => v != null)) as number | undefined;
  const rvol = timeOfDayRvol(c) ?? relativeVolume(c);

  const rsiScore = rsiScoreSmart(rsi, px, adxV);
  const macdScore = macdL != null && macdH != null ? clampScore((macdH > 0 ? 40 : -40) + (macdL > 0 ? 25 : -25) + histAccel(macd.hist) * 20) : 0;
  const adxScore =
    adxV != null && pdi != null && mdi != null
      ? clampScore((pdi > mdi ? 1 : -1) * Math.min(90, (adxV / 40) * 80))
      : 0;
  const vwapScore = vwapV ? clampScore(pctChange(vwapV, price) * 18 + (slopeLast(vwap) ?? 0) * 4) : 0;
  const emaScore =
    structure === "BULLISH" ? 78 : structure === "BEARISH" ? -78 : e20 ? clampScore(pctChange(e20, price) * 12) : 0;
  const volScore = rvol != null ? clampScore((rvol - 1) * 50 + (price >= (c[c.length - 2]?.close ?? price) ? 10 : -10)) : 0;

  const readings: IndicatorReading[] = [
    reading("RSI", tf, rsi != null ? +rsi.toFixed(1) : "—", dirFrom(rsiScore, 15, -15), rsiScore, rsiExplain(rsi, adxV)),
    reading(
      "MACD",
      tf,
      macdL != null ? +macdL.toFixed(3) : "—",
      dirFrom(macdScore, 15, -15),
      macdScore,
      macdH != null && macdH > 0 ? "Histogram positive; momentum expanding or constructive." : "Histogram negative or weak.",
    ),
    reading(
      "ADX",
      tf,
      adxV != null ? +adxV.toFixed(1) : "—",
      adxV != null && adxV >= 25 ? (pdi! > mdi! ? "BULLISH" : "BEARISH") : "NEUTRAL",
      adxScore,
      adxV != null ? `ADX ${adxV.toFixed(1)}; +DI ${pdi?.toFixed(1)} / -DI ${mdi?.toFixed(1)}` : "Insufficient ADX",
    ),
    reading(
      "VWAP",
      tf,
      vwapV ? (price >= vwapV ? "ABOVE" : "BELOW") : "—",
      vwapScore >= 15 ? "BULLISH" : vwapScore <= -15 ? "BEARISH" : "NEUTRAL",
      vwapScore,
      vwapV ? `Price is ${pctChange(vwapV, price).toFixed(2)}% vs session VWAP.` : "VWAP needs intraday data.",
    ),
    reading("EMA", tf, structure, structure, emaScore, "EMA 9/20/50 stack versus price."),
    reading(
      "VOLUME",
      tf,
      rvol != null ? `${rvol.toFixed(2)}x` : "—",
      rvol != null && rvol >= 1.4 ? "BULLISH" : rvol != null && rvol < 0.7 ? "WARNING" : "NEUTRAL",
      volScore,
      rvol != null ? `Relative volume ${rvol.toFixed(2)}x comparable period.` : "Volume thin.",
    ),
  ];

  return {
    timeframe: tf,
    ma,
    rsi7: lastNum(r7),
    rsi14: lastNum(r14),
    rsi21: lastNum(r21),
    macd: lastNum(macd.line),
    macdSignal: lastNum(macd.signal),
    macdHist: lastNum(macd.hist),
    adx: lastNum(adx.adx),
    plusDi: lastNum(adx.plusDI),
    minusDi: lastNum(adx.minusDI),
    bbUpper: lastNum(bb.upper),
    bbMiddle: lastNum(bb.mid),
    bbLower: lastNum(bb.lower),
    bbWidth: lastNum(bb.width),
    percentB: lastNum(bb.pctB),
    vwap: vwapV ?? null,
    vwapDevPct: vwapV ? pctChange(vwapV, price) : null,
    atr: atrV ?? null,
    atrPct: atrV ? (atrV / price) * 100 : null,
    stochK: lastNum(st.k),
    stochD: lastNum(st.d),
    cci: lastNum(cci),
    roc: lastNum(roc),
    momentum: px.length > 10 ? pctChange(px[px.length - 11]!, price) : null,
    relVolume: rvol,
    volumeSma: mean(c.slice(-20).map((x) => x.volume)),
    readings,
  };
}

function lastNum(xs: (number | null)[]): number | null {
  for (let i = xs.length - 1; i >= 0; i--) if (xs[i] != null) return xs[i]!;
  return null;
}
function maNum(series: (number | null)[], price: number): number | null {
  const v = lastNum(series);
  return v ? pctChange(v, price) : null;
}
function slopeLast(series: (number | null)[]): number | null {
  const clean = series.filter((v): v is number => v != null).slice(-6);
  if (clean.length < 4) return null;
  const sl = linRegSlope(clean);
  return pctChange(clean[0]!, clean[0]! + sl * 5);
}
function clampScore(n: number) {
  return Math.max(-100, Math.min(100, n));
}
function histAccel(hist: (number | null)[]): number {
  const h = hist.filter((v): v is number => v != null).slice(-4);
  if (h.length < 3) return 0;
  return h[h.length - 1]! - h[0]!;
}
function rsiScoreSmart(rsi: number | undefined, px: number[], adx?: number): number {
  if (rsi == null) return 0;
  const rising = px.length > 5 ? px[px.length - 1]! >= px[px.length - 5]! : true;
  if (rsi > 70 && rising && (adx ?? 0) >= 25) return 72;
  if (rsi > 70 && !rising) return -35;
  if (rsi < 30 && !rising && (adx ?? 0) >= 25) return -72;
  if (rsi < 30 && rising) return 28;
  return clampScore((rsi - 50) * 2.1);
}
function rsiExplain(rsi: number | undefined, adx?: number) {
  if (rsi == null) return "RSI unavailable.";
  if (rsi > 70 && (adx ?? 0) >= 25) return "RSI elevated with strong ADX — treated as trend momentum, not auto-bearish.";
  if (rsi > 70) return "RSI overbought; watch for divergence or failure swing.";
  if (rsi < 30) return "RSI oversold; confirmation still required.";
  if (rsi >= 50) return "RSI holds above 50 — bullish momentum bias.";
  return "RSI holds below 50 — bearish momentum bias.";
}

export function higherHighsLows(c: Candle[], look = 8) {
  if (c.length < look * 2) return { hh: false, hl: false, lh: false, ll: false };
  const a = c.slice(-look * 2, -look);
  const b = c.slice(-look);
  const aH = Math.max(...a.map((x) => x.high));
  const aL = Math.min(...a.map((x) => x.low));
  const bH = Math.max(...b.map((x) => x.high));
  const bL = Math.min(...b.map((x) => x.low));
  return { hh: bH > aH, hl: bL > aL, lh: bH < aH, ll: bL < aL };
}

export { highs, lows, closes };
