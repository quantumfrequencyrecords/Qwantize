import type { NewsItem, Signal } from "./types";

const BULL = [
  "beat", "beats", "upgrade", "upgraded", "raises", "raised guidance", "record", "surge",
  "soars", "rally", "bullish", "outperform", "buy rating", "contract win", "approval",
  "fda approval", "partnership", "buyback", "dividend increase", "strong demand", "all-time high",
];
const BEAR = [
  "miss", "misses", "downgrade", "downgraded", "cuts", "cut guidance", "probe", "lawsuit",
  "sec ", "fraud", "recall", "layoffs", "warning", "plunge", "tumble", "bearish", "underperform",
  "sell rating", "delay", "rejected", "investigation", "weak demand", "guidance cut",
];
const HIGH = ["earnings", "guidance", "fda", "sec", "merger", "acquisition", "m&a", "bankruptcy", "split", "offering"];

export function classifyNews(input: {
  id: string;
  headline: string;
  source: string;
  timestamp: number;
  url: string;
  summary?: string;
}): NewsItem {
  const text = `${input.headline} ${input.summary ?? ""}`.toLowerCase();
  let bull = 0;
  let bear = 0;
  for (const w of BULL) if (text.includes(w)) bull += 1;
  for (const w of BEAR) if (text.includes(w)) bear += 1;
  let sentiment: Signal = "NEUTRAL";
  if (bull > bear + 0.5) sentiment = "BULLISH";
  else if (bear > bull + 0.5) sentiment = "BEARISH";
  const impact: NewsItem["impact"] = HIGH.some((w) => text.includes(w)) ? "high" : bull + bear >= 2 ? "medium" : "low";
  let category = "general";
  if (text.includes("earn")) category = "earnings";
  else if (text.includes("upgrade") || text.includes("downgrade") || text.includes("analyst")) category = "analyst";
  else if (text.includes("fda")) category = "fda";
  else if (text.includes("sec") || text.includes("lawsuit")) category = "legal";
  else if (text.includes("merger") || text.includes("acquisition")) category = "m&a";
  else if (text.includes("ceo") || text.includes("cfo") || text.includes("appoint")) category = "management";
  const ageH = (Date.now() - input.timestamp) / 36e5;
  const relevance = Math.max(0.2, 1 - ageH / 72) * (impact === "high" ? 1 : impact === "medium" ? 0.7 : 0.4);
  return { ...input, sentiment, relevance, impact, category };
}

export function newsAggregate(items: NewsItem[]) {
  if (!items.length) return { bullish: 0, bearish: 0, neutral: 100, overall: "NEUTRAL" as Signal, freshness: 0 };
  let b = 0;
  let r = 0;
  let n = 0;
  let fresh = 0;
  for (const it of items) {
    const w = it.relevance * (it.impact === "high" ? 1.4 : 1);
    if (it.sentiment === "BULLISH") b += w;
    else if (it.sentiment === "BEARISH") r += w;
    else n += w;
    fresh += it.relevance;
  }
  const tot = b + r + n || 1;
  const overall: Signal = b > r * 1.15 ? "BULLISH" : r > b * 1.15 ? "BEARISH" : "NEUTRAL";
  return {
    bullish: Math.round((b / tot) * 100),
    bearish: Math.round((r / tot) * 100),
    neutral: Math.round((n / tot) * 100),
    overall,
    freshness: fresh / items.length,
  };
}
