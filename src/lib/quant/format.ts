import type { BiasLabel, SetupGrade, Signal } from "./types";

export function fmtPrice(n: number | null | undefined, digits?: number): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const d = digits ?? (Math.abs(n) >= 1000 ? 2 : Math.abs(n) >= 100 ? 2 : Math.abs(n) >= 1 ? 2 : 4);
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtPct(n: number | null | undefined, signed = true): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const s = `${n >= 0 && signed ? "+" : ""}${n.toFixed(2)}%`;
  return s;
}

export function fmtNum(n: number | null | undefined, d = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(d);
}

export function fmtVol(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function biasLabel(score: number): BiasLabel {
  if (score >= 80) return "EXTREMELY_BULLISH";
  if (score >= 60) return "STRONG_BULLISH";
  if (score >= 35) return "BULLISH";
  if (score >= 15) return "SLIGHT_BULLISH";
  if (score > -15) return "NEUTRAL";
  if (score > -35) return "SLIGHT_BEARISH";
  if (score > -60) return "BEARISH";
  if (score > -80) return "STRONG_BEARISH";
  return "EXTREMELY_BEARISH";
}

export function prettyBias(b: BiasLabel): string {
  return b.replaceAll("_", " ");
}

export function gradeFrom(score: number): SetupGrade {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "LOW";
}

export function signalFromScore(score: number): Signal {
  if (score >= 15) return "BULLISH";
  if (score <= -15) return "BEARISH";
  return "NEUTRAL";
}

export function toneFor(signal: Signal | BiasLabel | string): "bull" | "bear" | "warn" | "neutral" {
  const s = String(signal).toUpperCase();
  if (s.includes("BULL") || s === "LONG" || s === "ONLINE") return "bull";
  if (s.includes("BEAR") || s === "SHORT" || s === "FAILED") return "bear";
  if (s.includes("WARN") || s.includes("MIXED") || s.includes("CONFLICT") || s === "LIMITED") return "warn";
  return "neutral";
}
