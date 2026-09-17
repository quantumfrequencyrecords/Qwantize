import { DAY_TRADE_TFS, HIGHER_TFS, SHORT_TFS } from "./config";
import type { AppSettings, BiasLabel, IndicatorBundle, Signal, Timeframe, TimeframeBias } from "./types";
import { biasLabel, signalFromScore } from "./format";
import { clamp } from "./math";

export function tfSignal(bundle: IndicatorBundle): { score: number; signal: Signal } {
  const parts = bundle.readings.filter((r) => ["RSI", "MACD", "EMA", "VWAP", "ADX"].includes(r.name));
  if (!parts.length) return { score: 0, signal: "NEUTRAL" };
  const score = parts.reduce((s, r) => s + r.score, 0) / parts.length;
  return { score, signal: signalFromScore(score) };
}

export function weightedIndicatorScore(
  bundles: Partial<Record<Timeframe, IndicatorBundle>>,
  name: string,
  weights: Record<string, number>,
): number {
  let num = 0;
  let den = 0;
  for (const [tf, b] of Object.entries(bundles) as [Timeframe, IndicatorBundle][]) {
    const r = b.readings.find((x) => x.name === name);
    if (!r) continue;
    const w = weights[tf] ?? 0.1;
    const conf = r.confidence || 0.7;
    const sig = r.score >= 15 ? 1 : r.score <= -15 ? -1 : 0;
    num += sig * w * conf;
    den += w * conf;
  }
  if (!den) return 0;
  return clamp((num / den) * 100, -100, 100);
}

export function mtfAlignment(mtf: TimeframeBias[]): number {
  const avail = mtf.filter((t) => t.available);
  if (!avail.length) return 50;
  const bull = avail.filter((t) => t.bias === "BULLISH").length;
  const bear = avail.filter((t) => t.bias === "BEARISH").length;
  const agree = Math.max(bull, bear) / avail.length;
  if (agree >= 0.95) return 97;
  if (agree >= 0.75) return 84;
  if (agree >= 0.5) return 62;
  if (agree >= 0.3) return 38;
  return 16;
}

export function detectConflict(mtf: TimeframeBias[]) {
  const short = mtf.filter((t) => SHORT_TFS.includes(t.timeframe) && t.available);
  const higher = mtf.filter((t) => HIGHER_TFS.includes(t.timeframe) && t.available);
  const avg = (xs: TimeframeBias[]) => (xs.length ? xs.reduce((s, x) => s + x.score, 0) / xs.length : 0);
  const s = avg(short);
  const h = avg(higher);
  const shortSig = signalFromScore(s);
  const highSig = signalFromScore(h);
  const present = shortSig !== "NEUTRAL" && highSig !== "NEUTRAL" && shortSig !== highSig;
  let interpretation = "Timeframes are broadly aligned.";
  if (present && shortSig === "BULLISH") interpretation = "Possible countertrend bounce / lower-confidence long inside a higher-timeframe bearish trend.";
  else if (present && shortSig === "BEARISH") interpretation = "Possible countertrend fade / lower-confidence short inside a higher-timeframe bullish trend.";
  return { present, shortTerm: shortSig, higherTf: highSig, interpretation };
}

export function correlationPenalty(scores: number[]): number {
  if (!scores.length) return 0;
  let w = 1;
  let acc = 0;
  let den = 0;
  const factors = [1, 0.75, 0.5, 0.3, 0.2];
  for (let i = 0; i < scores.length; i++) {
    const f = factors[Math.min(i, factors.length - 1)]!;
    acc += scores[i]! * f;
    den += 100 * f;
    w = f;
  }
  void w;
  return den ? (acc / den) * 100 : 0;
}

export function regimeFrom(adx: number | null, bbWidth: number | null, spyScore: number, atrPct: number | null): string {
  const strong = (adx ?? 0) >= 25;
  const wide = (bbWidth ?? 0) > 0.06 || (atrPct ?? 0) > 2.2;
  const tight = (bbWidth ?? 0) < 0.025 && (atrPct ?? 0) < 1.1;
  if (strong && spyScore >= 35 && !tight) return "STRONG BULL TREND";
  if (strong && spyScore <= -35 && !tight) return "STRONG BEAR TREND";
  if (!strong && spyScore >= 20) return "WEAK BULL TREND";
  if (!strong && spyScore <= -20) return "WEAK BEAR TREND";
  if (tight) return "LOW VOLATILITY";
  if (wide && !strong) return "HIGH VOLATILITY";
  if (tight && Math.abs(spyScore) < 20) return "MEAN-REVERSION ENVIRONMENT";
  if (!strong && Math.abs(spyScore) < 15) return "RANGE";
  if (wide && strong) return "BREAKOUT ENVIRONMENT";
  return "RANGE";
}

export function adaptiveMultiplier(regime: string): { trend: number; meanRev: number; breakout: number; overall: number } {
  if (regime.includes("STRONG BULL") || regime.includes("STRONG BEAR"))
    return { trend: 1.12, meanRev: 0.82, breakout: 1.05, overall: 1.06 };
  if (regime.includes("RANGE") || regime.includes("MEAN-REVERSION"))
    return { trend: 0.85, meanRev: 1.12, breakout: 0.8, overall: 0.94 };
  if (regime.includes("HIGH VOLATILITY")) return { trend: 0.95, meanRev: 0.9, breakout: 1.05, overall: 0.92 };
  if (regime.includes("LOW VOLATILITY")) return { trend: 0.9, meanRev: 1.05, breakout: 1.08, overall: 0.96 };
  if (regime.includes("BREAKOUT")) return { trend: 1.05, meanRev: 0.8, breakout: 1.12, overall: 1.04 };
  return { trend: 1, meanRev: 1, breakout: 1, overall: 1 };
}

export function interpretBias(score: number): BiasLabel {
  return biasLabel(score);
}

export function activeTimeframes(mode: AppSettings["mode"]): Timeframe[] {
  if (mode === "day") return DAY_TRADE_TFS;
  if (mode === "swing") return ["1h", "4h", "1D", "1W"];
  return ["4h", "1D", "1W", "1M"];
}
