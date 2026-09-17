import { SECTOR_ETF } from "./config";
import { fmtNum } from "./format";
import { computeBundle, higherHighsLows, rsiWilder } from "./indicators";
import { newsAggregate } from "./news";
import { fetchNews, fetchOHLCV, fetchQuote, initHealth } from "./providers";
import {
  activeTimeframes,
  adaptiveMultiplier,
  correlationPenalty,
  detectConflict,
  mtfAlignment,
  regimeFrom,
  tfSignal,
  weightedIndicatorScore,
} from "./scoring";
import { buildLevels, detectDivergence, openingRange } from "./structure";
import { detectSetups } from "./setups";
import type { AnalysisResult, AppSettings, Candle, CategoryScore, IndicatorBundle, Signal, Timeframe, TimeframeBias, WarningItem } from "./types";
import { clamp } from "./math";
import { gradeFrom, prettyBias, signalFromScore } from "./format";
import { biasLabel } from "./format";

function ctxFrom(s: AppSettings) {
  return {
    keys: s.keys,
    enabled: s.enabledProviders,
    priority: s.providerPriority,
    allowPublicFeeds: s.allowPublicFeeds,
  };
}

export async function analyzeSymbol(symbol: string, settings: AppSettings): Promise<AnalysisResult> {
  const sym = symbol.trim().toUpperCase();
  initHealth(ctxFrom(settings));
  const tfs = activeTimeframes(settings.mode);
  const trail: string[] = [];
  const candles: Partial<Record<Timeframe, Candle[]>> = {};
  const bundles: Partial<Record<Timeframe, IndicatorBundle>> = {};
  let usedDemo = false;
  let qualityAcc: number[] = [];

  const quoteP = fetchQuote(sym, ctxFrom(settings));
  const newsP = fetchNews(sym, ctxFrom(settings)).catch(() => []);
  const ctxP = Promise.allSettled([
    fetchOHLCV("SPY", "1D", ctxFrom(settings)),
    fetchOHLCV("QQQ", "1D", ctxFrom(settings)),
    fetchOHLCV("IWM", "1D", ctxFrom(settings)),
  ]);

  const tfFetches = tfs.map(async (tf) => {
    const r = await fetchOHLCV(sym, tf, ctxFrom(settings));
    candles[tf] = r.candles;
    trail.push(`${tf}:${r.provider}`);
    qualityAcc.push(r.quality);
    if (r.provider === "Demo") usedDemo = true;
    const b = computeBundle(tf, r.candles);
    if (b) bundles[tf] = b;
  });
  await Promise.all(tfFetches);

  const quote = await quoteP;
  if (quote.provider === "Demo") usedDemo = true;
  const news = await newsP;
  const ctxRes = await ctxP;
  const spyC = ctxRes[0].status === "fulfilled" ? ctxRes[0].value.candles : [];
  const qqqC = ctxRes[1].status === "fulfilled" ? ctxRes[1].value.candles : [];
  const iwmC = ctxRes[2].status === "fulfilled" ? ctxRes[2].value.candles : [];

  const mtf: TimeframeBias[] = tfs.map((tf) => {
    const b = bundles[tf];
    if (!b) return { timeframe: tf, bias: "NEUTRAL" as Signal, score: 0, available: false };
    const s = tfSignal(b);
    return { timeframe: tf, bias: s.signal, score: s.score, available: true };
  });
  const alignment = mtfAlignment(mtf);
  const conflict = detectConflict(mtf);
  const dataQuality = Math.round(qualityAcc.length ? qualityAcc.reduce((a, b) => a + b, 0) / qualityAcc.length : quote.dataQuality);
  if (usedDemo) {
    /* demo caps later */
  }

  const weights = settings.timeframeWeights;
  const rsiS = weightedIndicatorScore(bundles, "RSI", weights);
  const macdS = weightedIndicatorScore(bundles, "MACD", weights);
  const emaS = weightedIndicatorScore(bundles, "EMA", weights);
  const adxS = weightedIndicatorScore(bundles, "ADX", weights);
  const vwapS = weightedIndicatorScore(bundles, "VWAP", weights);
  const volS = weightedIndicatorScore(bundles, "VOLUME", weights);

  const trendRaw = correlationPenalty([emaS, adxS, macdS]);
  const momRaw = correlationPenalty([rsiS, macdS, bundles["15m"]?.stochK ? (bundles["15m"]!.stochK! - 50) * 2 : 0]);
  const primary = bundles["15m"] ?? bundles["1h"] ?? bundles["1D"] ?? Object.values(bundles)[0];
  const daily = bundles["1D"];
  const hh = primary ? higherHighsLows(candles[primary.timeframe] ?? []) : { hh: false, hl: false, lh: false, ll: false };
  let structureRaw = 0;
  if (hh.hh && hh.hl) structureRaw = 70;
  else if (hh.lh && hh.ll) structureRaw = -70;
  else if (hh.hh) structureRaw = 25;
  else if (hh.ll) structureRaw = -25;

  const atr = primary?.atr ?? daily?.atr ?? quote.price * 0.012;
  const levels = buildLevels(candles["1D"] ?? [], candles["5m"] ?? candles["15m"], quote.price, atr);
  const nearRes = levels.find((l) => l.kind === "resistance" && l.price >= quote.price);
  const nearSup = levels.find((l) => l.kind === "support" && l.price <= quote.price);
  let levelRaw = 0;
  if (nearSup && (quote.price - nearSup.price) / atr < 0.4) levelRaw += 35;
  if (nearRes && (nearRes.price - quote.price) / atr < 0.4) levelRaw -= 35;
  if (vwapS > 20) levelRaw += 20;
  if (vwapS < -20) levelRaw -= 20;
  levelRaw = clamp(levelRaw, -100, 100);

  const spyRet = retOf(spyC);
  const qqqRet = retOf(qqqC);
  const iwmRet = retOf(iwmC);
  const stockRet = quote.changePercent;
  const relSpy = spyRet != null ? stockRet - spyRet : null;
  const sector = SECTOR_ETF[sym];
  const spyBias = signalFromScore((spyRet ?? 0) * 20);
  const qqqBias = signalFromScore((qqqRet ?? 0) * 20);
  const iwmBias = signalFromScore((iwmRet ?? 0) * 20);
  let marketRaw = 0;
  if (spyBias === "BULLISH") marketRaw += 30;
  if (spyBias === "BEARISH") marketRaw -= 30;
  if (qqqBias === spyBias) marketRaw += 15 * (spyBias === "BULLISH" ? 1 : spyBias === "BEARISH" ? -1 : 0);
  if (relSpy != null) marketRaw += clamp(relSpy * 12, -30, 30);
  const contextLabel =
    spyBias === "BULLISH" && qqqBias === "BULLISH" ? "HIGHLY SUPPORTIVE" : spyBias === "BEARISH" && qqqBias === "BEARISH" ? "HOSTILE TAPE" : "MIXED TAPE";

  const newsAg = newsAggregate(news);
  const newsRaw = newsAg.overall === "BULLISH" ? 40 * newsAg.freshness : newsAg.overall === "BEARISH" ? -40 * newsAg.freshness : 0;

  const volaRaw = (() => {
    const atrPct = primary?.atrPct ?? 1.2;
    const expanding = (primary?.bbWidth ?? 0.04) > 0.05;
    return clamp((expanding ? 25 : -10) + (atrPct - 1.2) * 20, -60, 70);
  })();

  const iw = settings.indicatorWeights;
  let trendScore =
    trendRaw * iw.trend +
    momRaw * iw.momentum +
    structureRaw * iw.structure +
    volS * iw.volume +
    volaRaw * iw.volatility +
    levelRaw * iw.levels +
    marketRaw * iw.market +
    newsRaw * iw.news;
  trendScore = clamp(trendScore, -100, 100);

  const regime = regimeFrom(primary?.adx ?? null, primary?.bbWidth ?? null, (spyRet ?? 0) * 25, primary?.atrPct ?? null);
  const adapt = adaptiveMultiplier(regime);
  const alignMult = clamp(0.75 + (alignment / 100) * 0.35, 0.75, 1.1);
  const dqMult = clamp(dataQuality / 100, 0.5, 1);
  trendScore = clamp(trendScore * adapt.overall * alignMult * dqMult, -100, 100);
  if (conflict.present) trendScore *= 0.72;

  const cats: CategoryScore[] = [
    pack("trend", "Trend", iw.trend, trendRaw, 20, "EMA stack, ADX, MACD trend component"),
    pack("mtf", "Multi-timeframe alignment", 0.2, (alignment - 50) * 2, 20, conflict.present ? conflict.interpretation : "Timeframes mostly agree"),
    pack("momentum", "Momentum", iw.momentum, momRaw, 15, "RSI / MACD / stochastic cluster with correlation penalty"),
    pack("volume", "Volume", iw.volume, volS, 15, "Relative volume and participation"),
    pack("structure", "Price structure", iw.structure, structureRaw, 10, hh.hh && hh.hl ? "Higher highs and higher lows" : hh.ll && hh.lh ? "Lower highs and lower lows" : "Mixed structure"),
    pack("levels", "Support / resistance", iw.levels, levelRaw, 10, "Distance to confluence zones, VWAP, pivots"),
    pack("market", "Market context", iw.market, marketRaw, 5, contextLabel),
    pack("news", "News", iw.news, newsRaw, 5, `News ${newsAg.overall.toLowerCase()} (${newsAg.bullish}/${newsAg.bearish}/${newsAg.neutral})`),
  ];

  let setupQuality = cats.reduce((s, c) => s + c.awarded, 0);
  const independent = [emaS, macdS, volS, vwapS, structureRaw].filter((x) => Math.abs(x) > 25);
  const sameDir = independent.filter((x) => Math.sign(x) === Math.sign(trendScore) || trendScore === 0);
  const confluenceBonus = Math.min(8, sameDir.length * 1.6);
  setupQuality = clamp(setupQuality + confluenceBonus, 0, 100);
  if (conflict.present) setupQuality = clamp(setupQuality - 12, 0, 100);
  if (dataQuality < 60) setupQuality = Math.min(setupQuality, 62);
  if (usedDemo) setupQuality = Math.min(setupQuality, 58);

  const grade = gradeFrom(setupQuality);
  const bias = biasLabel(trendScore);
  const confidence = clamp(
    40 +
      alignment * 0.25 +
      (dataQuality - 50) * 0.25 +
      Math.min(18, Math.abs(trendScore) * 0.12) -
      (conflict.present ? 14 : 0) -
      (usedDemo ? 18 : 0),
    18,
    94,
  );

  const rsiSeries = (candles["15m"] ?? candles["1D"] ?? []).map((c) => c.close);
  const div = detectDivergence(candles["15m"] ?? candles["1D"] ?? [], rsiWilder(rsiSeries, 14));

  const warnings: WarningItem[] = [];
  if (usedDemo)
    warnings.push({
      code: "DEMO",
      title: "DEMO / FALLBACK DATA",
      detail: "Live providers were unavailable. Add a free Finnhub, Twelve Data, or Alpha Vantage key in Settings for real market data. Scores are capped.",
      severity: "critical",
    });
  if (dataQuality < 70)
    warnings.push({
      code: "DQ",
      title: "DATA QUALITY WARNING",
      detail: `Composite data quality is ${dataQuality}/100. Treat indicators on thin or stale candles as unreliable.`,
      severity: dataQuality < 50 ? "critical" : "warning",
    });
  if (conflict.present)
    warnings.push({
      code: "MTF",
      title: "MULTI-TIMEFRAME CONFLICT",
      detail: `Short-term ${conflict.shortTerm}, higher-timeframe ${conflict.higherTf}. ${conflict.interpretation}`,
      severity: "warning",
    });
  if ((primary?.relVolume ?? 1) < 0.85 && Math.abs(trendScore) > 40)
    warnings.push({
      code: "VOL",
      title: "LOW VOLUME",
      detail: "Directional move lacks participation. Breakouts without volume fail more often.",
      severity: "warning",
    });
  if (nearRes && (nearRes.price - quote.price) / atr < 0.45 && trendScore > 20)
    warnings.push({
      code: "RES",
      title: "RESISTANCE NEARBY",
      detail: `Major resistance ${nearRes.label} at ${nearRes.price.toFixed(2)} is only ${((nearRes.price - quote.price) / atr).toFixed(2)} ATR above price.`,
      severity: "warning",
    });
  if (div.bearish)
    warnings.push({ code: "DIV", title: "BEARISH RSI DIVERGENCE", detail: "Price made a higher high while RSI did not.", severity: "warning" });
  if (div.bullish)
    warnings.push({ code: "DIVB", title: "BULLISH RSI DIVERGENCE", detail: "Price made a lower low while RSI did not.", severity: "info" });

  const setups = detectSetups({
    price: quote.price,
    atr,
    daily,
    intra: bundles["15m"] ?? bundles["5m"] ?? primary,
    mtf,
    levels,
    rvol: primary?.relVolume ?? null,
    spyBull: spyBias === "BULLISH",
    alignment,
    dataQuality,
    usedDemo,
  });
  const primarySetup = setups[0]!;
  if (grade === "A+" && (dataQuality < 70 || usedDemo || primarySetup.noTrade)) {
    /* safety: never show A+ on bad data — already capped */
  }

  const keyIndicators = (primary?.readings ?? []).map((r) => ({ ...r }));
  const dayTradeBias = primarySetup.direction === "NONE" ? (trendScore >= 25 ? "LONG" : trendScore <= -25 ? "SHORT" : "NONE") : primarySetup.direction;
  const status =
    primarySetup.noTrade ? "NO HIGH-QUALITY SETUP" : setupQuality >= 80 ? "HIGH-QUALITY SETUP" : setupQuality >= 60 ? "WATCHLIST SETUP" : "LOW QUALITY";

  const gapPct = quote.previousClose ? ((quote.open ?? quote.price) - quote.previousClose) / quote.previousClose * 100 : 0;
  const gapKind = Math.abs(gapPct) < 0.15 ? "Flat Open" : gapPct > 1.5 ? "Large Gap Up" : gapPct > 0.15 ? "Gap Up" : gapPct < -1.5 ? "Large Gap Down" : "Gap Down";

  const expectedMove = { value: atr * 1.2, pct: (atr * 1.2) / quote.price * 100, source: "atr" as const };

  const intra = candles["5m"] ?? candles["15m"] ?? [];
  const opening = intra.length
    ? { or5: openingRange(intra, 5), or15: openingRange(intra, 15), or30: openingRange(intra, 30) }
    : undefined;

  const explainability = [
    `Trend score ${fmtNum(trendScore, 0)} (${prettyBias(bias)}) from weighted categories, then alignment × data-quality × regime multipliers.`,
    `Timeframe alignment ${alignment}/100. ${conflict.present ? conflict.interpretation : "No major higher-vs-lower conflict."}`,
    `Setup quality ${setupQuality.toFixed(0)}/100 (${grade}). ${primarySetup.type}.`,
    `Confidence ${confidence.toFixed(0)}/100 is not a calibrated probability.`,
  ];

  return {
    symbol: sym,
    quote: { ...quote, dataQuality },
    analyzedAt: Date.now(),
    lookback: settings.lookback,
    mode: settings.mode,
    dataQuality,
    providerTrail: trail,
    bias,
    trendScore,
    confidence,
    setupQuality,
    grade,
    dayTradeBias,
    status,
    alignment,
    mtf,
    conflict,
    categories: cats,
    keyIndicators,
    bundles,
    candles,
    levels,
    setups,
    primarySetup,
    news,
    newsSentiment: newsAg,
    marketContext: {
      spyBias,
      qqqBias,
      iwmBias,
      vix: null,
      relativeVsSpy: relSpy,
      relativeVsSector: null,
      sector: sector ?? null,
      label: contextLabel,
    },
    regime,
    expectedMove,
    gap: {
      pct: gapPct,
      kind: gapKind,
      fillStatus: quote.previousClose && quote.low && quote.high
        ? quote.low <= quote.previousClose && quote.high >= quote.previousClose
          ? "filled"
          : "open"
        : "unknown",
    },
    openingRange: opening,
    warnings,
    explainability,
    usedDemo,
  };
}

function retOf(c: Candle[]): number | null {
  if (c.length < 2) return null;
  const a = c[c.length - 2]!.close;
  const b = c[c.length - 1]!.close;
  return a ? ((b - a) / a) * 100 : null;
}

function pack(key: string, label: string, weight: number, raw: number, max: number, explanation: string): CategoryScore {
  const awarded = clamp(((raw + 100) / 200) * max, 0, max);
  return { key, label, weight, raw, awarded, max, explanation };
}

void gradeFrom;
void biasLabel;
