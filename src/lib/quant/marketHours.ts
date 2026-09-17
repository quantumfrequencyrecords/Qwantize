import type { MarketSession } from "./types";

const NY = "America/New_York";

export function nyParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: NY,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    weekday: parts.weekday ?? "Mon",
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** Observed US market holidays (fixed + weekday-adjusted major ones for 2024–2027). */
const HOLIDAYS = new Set([
  "2024-01-01",
  "2024-01-15",
  "2024-02-19",
  "2024-03-29",
  "2024-05-27",
  "2024-06-19",
  "2024-07-04",
  "2024-09-02",
  "2024-11-28",
  "2024-12-25",
  "2025-01-01",
  "2025-01-20",
  "2025-02-17",
  "2025-04-18",
  "2025-05-26",
  "2025-06-19",
  "2025-07-04",
  "2025-09-01",
  "2025-11-27",
  "2025-12-25",
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03",
  "2026-09-07",
  "2026-11-26",
  "2026-12-25",
  "2027-01-01",
  "2027-01-18",
  "2027-02-15",
  "2027-03-26",
  "2027-05-31",
  "2027-06-18",
  "2027-07-05",
  "2027-09-06",
  "2027-11-25",
  "2027-12-24",
]);

export function isHoliday(date = new Date()): boolean {
  const p = nyParts(date);
  const key = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  return HOLIDAYS.has(key);
}

export function getMarketSession(date = new Date()): MarketSession {
  const p = nyParts(date);
  if (p.weekday === "Sat" || p.weekday === "Sun") return "WEEKEND";
  if (isHoliday(date)) return "HOLIDAY";
  if (p.minutes >= 4 * 60 && p.minutes < 9 * 60 + 30) return "PREMARKET";
  if (p.minutes >= 9 * 60 + 30 && p.minutes < 16 * 60) return "OPEN";
  if (p.minutes >= 16 * 60 && p.minutes < 20 * 60) return "AFTERHOURS";
  return "CLOSED";
}

export function sessionLabel(s: MarketSession): string {
  switch (s) {
    case "OPEN":
      return "MARKET OPEN";
    case "PREMARKET":
      return "PREMARKET";
    case "AFTERHOURS":
      return "AFTER HOURS";
    case "WEEKEND":
      return "WEEKEND";
    case "HOLIDAY":
      return "MARKET HOLIDAY";
    default:
      return "MARKET CLOSED";
  }
}

export function lastUpdatedEt(ts = Date.now()): string {
  return new Date(ts).toLocaleString("en-US", {
    timeZone: NY,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
