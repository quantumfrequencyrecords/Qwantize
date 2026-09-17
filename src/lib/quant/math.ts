export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function round(n: number, d = 2): number {
  const p = 10 ** d;
  return Math.round(n * p) / p;
}

export function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = mean(values.slice(0, period));
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function last<T>(xs: T[]): T | undefined {
  return xs.length ? xs[xs.length - 1] : undefined;
}

export function lastN<T>(xs: T[], n: number): T[] {
  return xs.slice(Math.max(0, xs.length - n));
}

export function pctChange(from: number, to: number): number {
  if (!from) return 0;
  return ((to - from) / from) * 100;
}

export function slopePct(series: (number | null)[], lookback = 5): number | null {
  const clean = series.filter((v): v is number => v != null);
  if (clean.length < lookback + 1) return null;
  const a = clean[clean.length - 1 - lookback]!;
  const b = clean[clean.length - 1]!;
  return pctChange(a, b);
}

export function signScore(n: number, dead = 0.05): -1 | 0 | 1 {
  if (n > dead) return 1;
  if (n < -dead) return -1;
  return 0;
}

export function expDecay(ageBars: number, lambda: number): number {
  return Math.exp(-lambda * Math.max(0, ageBars));
}

export function seedFrom(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function linRegSlope(ys: number[]): number {
  const n = ys.length;
  if (n < 2) return 0;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += ys[i]!;
    sumXY += i * ys[i]!;
    sumXX += i * i;
  }
  const den = n * sumXX - sumX * sumX;
  if (!den) return 0;
  return (n * sumXY - sumX * sumY) / den;
}

export function percentileRank(value: number, universe: number[]): number {
  if (!universe.length) return 50;
  const below = universe.filter((x) => x <= value).length;
  return (below / universe.length) * 100;
}

export function resample(
  candles: { timestamp: number; open: number; high: number; low: number; close: number; volume: number }[],
  bucketMs: number,
) {
  if (!candles.length) return [];
  const out: typeof candles = [];
  let bucket = Math.floor(candles[0]!.timestamp / bucketMs) * bucketMs;
  let cur = { ...candles[0]!, timestamp: bucket };
  for (const c of candles) {
    const b = Math.floor(c.timestamp / bucketMs) * bucketMs;
    if (b !== bucket) {
      out.push(cur);
      bucket = b;
      cur = { ...c, timestamp: bucket };
    } else {
      cur.high = Math.max(cur.high, c.high);
      cur.low = Math.min(cur.low, c.low);
      cur.close = c.close;
      cur.volume += c.volume;
    }
  }
  out.push(cur);
  return out;
}
