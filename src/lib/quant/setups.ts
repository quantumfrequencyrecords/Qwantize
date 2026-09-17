import { gradeFrom } from "./format";
import { clamp } from "./math";
import { nearest } from "./structure";
import type { IndicatorBundle, SetupPlan, SrLevel, Timeframe, TimeframeBias } from "./types";

function rr(entry: number, stop: number, target: number, dir: "LONG" | "SHORT") {
  const risk = dir === "LONG" ? entry - stop : stop - entry;
  const reward = dir === "LONG" ? target - entry : entry - target;
  if (risk <= 0) return null;
  return reward / risk;
}

function gradePlan(partial: Omit<SetupPlan, "grade">): SetupPlan {
  return { ...partial, grade: gradeFrom(partial.quality) };
}

export function detectSetups(args: {
  price: number;
  atr: number;
  daily: IndicatorBundle | undefined;
  intra: IndicatorBundle | undefined;
  mtf: TimeframeBias[];
  levels: SrLevel[];
  rvol: number | null;
  spyBull: boolean;
  alignment: number;
  dataQuality: number;
  usedDemo: boolean;
}): SetupPlan[] {
  const { price, atr, intra, mtf, levels, rvol, spyBull, alignment, dataQuality, usedDemo } = args;
  const dirTf = mtf.filter((t) => (["1h", "4h", "1D"] as Timeframe[]).includes(t.timeframe));
  const higherBull = dirTf.filter((t) => t.bias === "BULLISH").length >= dirTf.filter((t) => t.bias === "BEARISH").length;
  const longBias = higherBull;
  const res = nearest(levels, price, "resistance");
  const sup = nearest(levels, price, "support");
  const vwap = intra?.vwap ?? null;
  const rsi = intra?.rsi14 ?? 50;
  const macdH = intra?.macdHist ?? 0;
  const adx = intra?.adx ?? args.daily?.adx ?? 0;
  const ema20 = intra?.ma.ema20 ?? args.daily?.ma.ema20 ?? price;
  const bbWidth = intra?.bbWidth ?? args.daily?.bbWidth ?? 0.04;
  const percentB = intra?.percentB ?? 0.5;
  const volOk = (rvol ?? 1) >= 1.35;
  const mtfBull = mtf.filter((t) => t.bias === "BULLISH").length;
  const mtfBear = mtf.filter((t) => t.bias === "BEARISH").length;

  const plans: SetupPlan[] = [];

  const breakoutLong = res && price >= res.price * 0.998 && volOk && macdH >= 0 && adx >= 18 && mtfBull >= 3;
  const breakoutShort = sup && price <= sup.price * 1.002 && volOk && macdH <= 0 && adx >= 18 && mtfBear >= 3;

  if (breakoutLong || breakoutShort) {
    const long = Boolean(breakoutLong);
    const level = long ? res! : sup!;
    const entryLow = long ? level.price : price - atr * 0.15;
    const entryHigh = long ? price + atr * 0.1 : level.price;
    const stop = long ? Math.min(level.price, ema20, vwap ?? price) - atr * 0.7 : Math.max(level.price, ema20) + atr * 0.7;
    const t1 = long ? price + atr * 1.2 : price - atr * 1.2;
    const t2 = long ? price + atr * 2.1 : price - atr * 2.1;
    const t3 = long ? (nearest(levels, t2, "resistance")?.price ?? price + atr * 3.2) : (nearest(levels, t2, "support")?.price ?? price - atr * 3.2);
    const entry = (entryLow + entryHigh) / 2;
    const quality = clamp(
      20 + (volOk ? 20 : 4) + Math.min(20, adx) + Math.min(20, alignment / 5) + (spyBull === long ? 8 : 0) + (macdH * (long ? 1 : -1) > 0 ? 12 : 0),
      0,
      99,
    );
    plans.push(
      gradePlan({
        type: long ? "BULLISH BREAKOUT" : "BEARISH BREAKDOWN",
        direction: long ? "LONG" : "SHORT",
        quality,
        entryLow,
        entryHigh,
        stop,
        targets: [
          { label: "T1", price: t1, rr: rr(entry, stop, t1, long ? "LONG" : "SHORT") },
          { label: "T2", price: t2, rr: rr(entry, stop, t2, long ? "LONG" : "SHORT") },
          { label: "T3", price: t3, rr: rr(entry, stop, t3, long ? "LONG" : "SHORT") },
        ],
        reasons: [
          `${long ? "Resistance" : "Support"} ${level.label} at ${level.price.toFixed(2)}`,
          volOk ? "Volume confirmation" : "Volume unconfirmed",
          `ADX ${adx.toFixed(1)}`,
          `${mtfBull} bullish / ${mtfBear} bearish timeframes`,
        ],
        risks: [!volOk ? "Breakout without volume — possible false break" : "", res && long && res.score > 70 ? "Strong nearby supply" : ""].filter(Boolean),
        checklist: [
          { label: "Trend", ok: long === longBias },
          { label: "MTF alignment", ok: alignment >= 70 },
          { label: "Momentum", ok: long ? macdH > 0 : macdH < 0 },
          { label: "Volume", ok: volOk },
          { label: "VWAP", ok: vwap ? (long ? price >= vwap : price <= vwap) : false },
          { label: "Structure", ok: true },
          { label: "Level clearance", ok: true },
          { label: "Market context", ok: spyBull === long },
        ],
        noTrade: usedDemo || dataQuality < 55,
        noTradeReason: usedDemo ? "Demo data cannot validate a live breakout." : dataQuality < 55 ? "Data quality too low." : undefined,
      }),
    );
  }

  if (vwap && intra) {
    const above = price >= vwap;
    const reclaim = above && (intra.ma.ema9 ?? 0) >= (intra.ma.ema20 ?? 0) && rsi >= 50 && macdH > 0;
    const reject = !above && rsi <= 50 && macdH < 0;
    if (reclaim || reject) {
      const long = reclaim;
      const entryLow = long ? vwap - atr * 0.15 : price - atr * 0.1;
      const entryHigh = long ? vwap + atr * 0.25 : vwap;
      const stop = long ? vwap - atr * 0.9 : vwap + atr * 0.9;
      const entry = (entryLow + entryHigh) / 2;
      const t1 = long ? price + atr * 1.0 : price - atr * 1.0;
      const t2 = long ? price + atr * 1.8 : price - atr * 1.8;
      plans.push(
        gradePlan({
          type: long ? "VWAP RECLAIM" : "VWAP REJECTION",
          direction: long ? "LONG" : "SHORT",
          quality: clamp(62 + (volOk ? 12 : 0) + (alignment - 50) / 5 + (adx > 20 ? 8 : 0), 40, 96),
          entryLow,
          entryHigh,
          stop,
          targets: [
            { label: "T1", price: t1, rr: rr(entry, stop, t1, long ? "LONG" : "SHORT") },
            { label: "T2", price: t2, rr: rr(entry, stop, t2, long ? "LONG" : "SHORT") },
          ],
          reasons: [
            long ? "Price reclaimed VWAP" : "Price rejected at VWAP",
            rsi >= 50 === long ? "RSI confirms side of 50" : "RSI mixed",
            "Intraday VWAP slope used as dynamic bias",
          ],
          risks: ["VWAP mean-reversion can fail in strong trends"],
          checklist: [
            { label: "Trend", ok: long === longBias },
            { label: "MTF alignment", ok: alignment >= 60 },
            { label: "Momentum", ok: long ? macdH > 0 : macdH < 0 },
            { label: "Volume", ok: volOk },
            { label: "VWAP", ok: true },
            { label: "Structure", ok: true },
            { label: "Resistance clearance", ok: !res || Math.abs(res.price - price) / atr > 0.6 },
            { label: "Market context", ok: spyBull === long || !long },
          ],
          noTrade: usedDemo && dataQuality < 50,
        }),
      );
    }
  }

  const pullback =
    longBias &&
    vwap &&
    price > (vwap ?? 0) * 0.997 &&
    Math.abs(price - ema20) / atr < 0.55 &&
    adx >= 22 &&
    macdH >= 0;
  if (pullback) {
    const stop = Math.min(ema20, vwap ?? ema20) - atr * 0.8;
    const t1 = price + atr * 1.4;
    const t2 = res?.price ?? price + atr * 2.4;
    plans.push(
      gradePlan({
        type: "TREND CONTINUATION",
        direction: "LONG",
        quality: clamp(70 + (volOk ? 10 : 0) + Math.min(12, adx / 4), 55, 96),
        entryLow: Math.min(price, ema20) - atr * 0.05,
        entryHigh: Math.max(price, ema20) + atr * 0.12,
        stop,
        targets: [
          { label: "T1", price: t1, rr: rr(price, stop, t1, "LONG") },
          { label: "T2", price: t2, rr: rr(price, stop, t2, "LONG") },
        ],
        reasons: ["Higher-timeframe bullish", "Pullback toward EMA/VWAP", `ADX ${adx.toFixed(1)} supports trend`],
        risks: res && (res.price - price) / atr < 0.6 ? [`Resistance ${res.price.toFixed(2)} nearby`] : [],
        checklist: [
          { label: "Trend", ok: true },
          { label: "MTF alignment", ok: alignment >= 70 },
          { label: "Momentum", ok: macdH > 0 },
          { label: "Volume", ok: volOk },
          { label: "VWAP", ok: true },
          { label: "Structure", ok: true },
          { label: "Resistance clearance", ok: !res || (res.price - price) / atr > 0.7 },
          { label: "Market context", ok: spyBull },
        ],
        noTrade: false,
      }),
    );
  }

  if (bbWidth < 0.028 && adx < 22) {
    plans.push(
      gradePlan({
        type: "VOLATILITY EXPANSION WATCH",
        direction: percentB >= 0.5 ? "LONG" : percentB <= 0.5 ? "SHORT" : "NONE",
        quality: clamp(58 + (volOk ? 10 : 0) + (0.028 - bbWidth) * 400, 45, 88),
        entryLow: price - atr * 0.2,
        entryHigh: price + atr * 0.2,
        stop: percentB >= 0.5 ? price - atr * 1.1 : price + atr * 1.1,
        targets: [
          { label: "T1", price: percentB >= 0.5 ? price + atr * 1.6 : price - atr * 1.6, rr: 1.4 },
          { label: "T2", price: percentB >= 0.5 ? price + atr * 2.6 : price - atr * 2.6, rr: 2.3 },
        ],
        reasons: ["Bollinger bandwidth compressed", "ATR compressed relative to recent range", "Expansion often follows squeeze"],
        risks: ["Direction of expansion is not confirmed until a close outside the band with volume"],
        checklist: [
          { label: "Trend", ok: false },
          { label: "MTF alignment", ok: alignment >= 55 },
          { label: "Momentum", ok: Math.abs(macdH) > 0 },
          { label: "Volume", ok: volOk },
          { label: "VWAP", ok: Boolean(vwap) },
          { label: "Structure", ok: true },
          { label: "Resistance clearance", ok: false },
          { label: "Market context", ok: true },
        ],
        noTrade: true,
        noTradeReason: "Watch only — wait for expansion and volume confirmation.",
      }),
    );
  }

  const reversalEvidence = (rsi < 30 || rsi > 70) && adx < 22 && ((sup && Math.abs(price - sup.price) / atr < 0.4) || (res && Math.abs(price - res.price) / atr < 0.4));
  if (reversalEvidence) {
    const long = rsi < 30;
    plans.push(
      gradePlan({
        type: "REVERSAL (HIGH BAR)",
        direction: long ? "LONG" : "SHORT",
        quality: clamp(48 + (volOk ? 6 : 0) + (alignment < 50 ? 8 : 0), 35, 72),
        entryLow: price - atr * 0.12,
        entryHigh: price + atr * 0.12,
        stop: long ? price - atr * 1.2 : price + atr * 1.2,
        targets: [{ label: "T1", price: long ? price + atr : price - atr, rr: 0.85 }],
        reasons: ["Oscillator extreme", "Price at a major level", "Trend strength not extreme — reversal is possible but unconfirmed"],
        risks: ["Reversals require multiple independent confirms", "Do not fade a strong ADX trend from one oscillator"],
        checklist: [
          { label: "Trend", ok: false },
          { label: "MTF alignment", ok: false },
          { label: "Momentum", ok: true },
          { label: "Volume", ok: volOk },
          { label: "VWAP", ok: Boolean(vwap) },
          { label: "Structure", ok: true },
          { label: "Resistance clearance", ok: false },
          { label: "Market context", ok: false },
        ],
        noTrade: true,
        noTradeReason: "Reversal evidence is incomplete — treated as a watch, not a trade.",
      }),
    );
  }

  if (!plans.length) {
    plans.push(
      gradePlan({
        type: "NO HIGH-QUALITY SETUP",
        direction: "NONE",
        quality: clamp(32 + alignment / 8, 15, 58),
        entryLow: null,
        entryHigh: null,
        stop: null,
        targets: [],
        reasons: ["No independent confluence cluster met the day-trade checklist"],
        risks: ["Forcing a trade here is the usual way to donate edge"],
        checklist: [
          { label: "Trend", ok: false },
          { label: "MTF alignment", ok: alignment >= 75 },
          { label: "Momentum", ok: Math.abs(macdH) > 0.1 },
          { label: "Volume", ok: volOk },
          { label: "VWAP", ok: Boolean(vwap) },
          { label: "Structure", ok: false },
          { label: "Resistance clearance", ok: false },
          { label: "Market context", ok: spyBull },
        ],
        noTrade: true,
        noTradeReason: "Indicators are mixed, volume is unconvincing, or price is trapped between levels.",
      }),
    );
  }

  return plans.sort((a, b) => b.quality - a.quality);
}
