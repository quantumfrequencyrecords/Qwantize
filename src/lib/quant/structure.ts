import type { Candle, SrLevel } from "./types";
import { last } from "./math";
import { sessionVwap } from "./indicators";

function swings(c: Candle[], left = 3, right = 3) {
  const highs: { i: number; price: number }[] = [];
  const lows: { i: number; price: number }[] = [];
  for (let i = left; i < c.length - right; i++) {
    const h = c[i]!.high;
    const l = c[i]!.low;
    let isH = true;
    let isL = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (c[j]!.high >= h) isH = false;
      if (c[j]!.low <= l) isL = false;
    }
    if (isH) highs.push({ i, price: h });
    if (isL) lows.push({ i, price: l });
  }
  return { highs, lows };
}

export function classicPivots(prev: Candle) {
  const p = (prev.high + prev.low + prev.close) / 3;
  const r1 = 2 * p - prev.low;
  const s1 = 2 * p - prev.high;
  const r2 = p + (prev.high - prev.low);
  const s2 = p - (prev.high - prev.low);
  const r3 = prev.high + 2 * (p - prev.low);
  const s3 = prev.low - 2 * (prev.high - p);
  return { p, r1, r2, r3, s1, s2, s3 };
}

export function fibLevels(high: number, low: number) {
  const rng = high - low;
  const retrace = (r: number) => high - rng * r;
  return [
    { r: 0.236, price: retrace(0.236) },
    { r: 0.382, price: retrace(0.382) },
    { r: 0.5, price: retrace(0.5) },
    { r: 0.618, price: retrace(0.618) },
    { r: 0.786, price: retrace(0.786) },
  ];
}

export function volumeProfile(c: Candle[], bins = 24) {
  if (c.length < 10) return { poc: null as number | null, vah: null as number | null, val: null as number | null, nodes: [] as { price: number; vol: number }[] };
  const lo = Math.min(...c.map((x) => x.low));
  const hi = Math.max(...c.map((x) => x.high));
  const step = (hi - lo) / bins || 0.01;
  const vol = Array(bins).fill(0) as number[];
  for (const bar of c) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor(( (bar.high + bar.low) / 2 - lo) / step)));
    vol[idx] += bar.volume;
  }
  const nodes = vol.map((v, i) => ({ price: lo + (i + 0.5) * step, vol: v }));
  const poc = nodes.reduce((a, b) => (b.vol > a.vol ? b : a), nodes[0]!).price;
  const total = vol.reduce((a, b) => a + b, 0);
  const target = total * 0.7;
  const ranked = [...nodes].sort((a, b) => b.vol - a.vol);
  const picked: typeof nodes = [];
  let acc = 0;
  for (const n of ranked) {
    picked.push(n);
    acc += n.vol;
    if (acc >= target) break;
  }
  const prices = picked.map((p) => p.price);
  return { poc, vah: Math.max(...prices), val: Math.min(...prices), nodes };
}

export function openingRange(c: Candle[], minutes: number) {
  const first = c[0];
  if (!first) return undefined;
  const end = first.timestamp + minutes * 60_000;
  const slice = c.filter((x) => x.timestamp <= end);
  if (slice.length < 2) return undefined;
  return { high: Math.max(...slice.map((x) => x.high)), low: Math.min(...slice.map((x) => x.low)) };
}

function pushLevel(
  bucket: Map<number, SrLevel>,
  price: number,
  kind: SrLevel["kind"],
  label: string,
  score: number,
  atr: number,
) {
  const key = Math.round(price / Math.max(atr * 0.12, price * 0.0008));
  const existing = bucket.get(key);
  if (existing) {
    existing.sources.push(label);
    existing.score = Math.min(100, existing.score + score * 0.55);
    existing.low = Math.min(existing.low, price);
    existing.high = Math.max(existing.high, price);
    existing.price = (existing.price * (existing.sources.length - 1) + price) / existing.sources.length;
    return;
  }
  bucket.set(key, {
    price,
    kind,
    label,
    score,
    sources: [label],
    low: price,
    high: price,
  });
}

export function buildLevels(daily: Candle[], intra: Candle[] | undefined, lastPrice: number, atr: number): SrLevel[] {
  const bucket = new Map<number, SrLevel>();
  const src = intra && intra.length > 40 ? intra : daily;
  const { highs, lows } = swings(src);
  for (const h of highs.slice(-8)) pushLevel(bucket, h.price, "resistance", "swing high", 18, atr);
  for (const l of lows.slice(-8)) pushLevel(bucket, l.price, "support", "swing low", 18, atr);

  if (daily.length >= 2) {
    const prev = daily[daily.length - 2]!;
    const piv = classicPivots(prev);
    pushLevel(bucket, prev.high, "resistance", "previous high", 20, atr);
    pushLevel(bucket, prev.low, "support", "previous low", 20, atr);
    pushLevel(bucket, prev.close, "pivot", "previous close", 8, atr);
    pushLevel(bucket, piv.p, "pivot", "pivot", 12, atr);
    pushLevel(bucket, piv.r1, "resistance", "R1", 10, atr);
    pushLevel(bucket, piv.r2, "resistance", "R2", 8, atr);
    pushLevel(bucket, piv.r3, "resistance", "R3", 6, atr);
    pushLevel(bucket, piv.s1, "support", "S1", 10, atr);
    pushLevel(bucket, piv.s2, "support", "S2", 8, atr);
    pushLevel(bucket, piv.s3, "support", "S3", 6, atr);
  }

  const vp = volumeProfile(src.slice(-80));
  if (vp.poc) pushLevel(bucket, vp.poc, "pivot", "POC", 15, atr);
  if (vp.vah) pushLevel(bucket, vp.vah, "resistance", "VAH", 12, atr);
  if (vp.val) pushLevel(bucket, vp.val, "support", "VAL", 12, atr);

  const hi = Math.max(...src.slice(-80).map((x) => x.high));
  const lo = Math.min(...src.slice(-80).map((x) => x.low));
  for (const f of fibLevels(hi, lo)) pushLevel(bucket, f.price, "pivot", `Fib ${f.r}`, 6, atr);

  if (intra?.length) {
    const v = last(sessionVwap(intra).filter((x) => x != null)) as number | undefined;
    if (v) pushLevel(bucket, v, "dynamic", "VWAP", 14, atr);
    const or5 = openingRange(intra, 5);
    const or15 = openingRange(intra, 15);
    const or30 = openingRange(intra, 30);
    if (or5) {
      pushLevel(bucket, or5.high, "resistance", "OR5 high", 11, atr);
      pushLevel(bucket, or5.low, "support", "OR5 low", 11, atr);
    }
    if (or15) {
      pushLevel(bucket, or15.high, "resistance", "OR15 high", 10, atr);
      pushLevel(bucket, or15.low, "support", "OR15 low", 10, atr);
    }
    if (or30) {
      pushLevel(bucket, or30.high, "resistance", "OR30 high", 8, atr);
      pushLevel(bucket, or30.low, "support", "OR30 low", 8, atr);
    }
  }

  const levels = [...bucket.values()].map((l) => {
    const touches = src.filter((c) => c.low <= l.high + atr * 0.05 && c.high >= l.low - atr * 0.05).length;
    l.score = Math.min(100, l.score + Math.min(20, touches * 2));
    if (l.price >= lastPrice) l.kind = l.kind === "dynamic" ? "dynamic" : "resistance";
    else l.kind = l.kind === "dynamic" ? "dynamic" : "support";
    return l;
  });
  levels.sort((a, b) => Math.abs(a.price - lastPrice) - Math.abs(b.price - lastPrice));
  return levels.slice(0, 16);
}

export function nearest(levels: SrLevel[], price: number, kind: "support" | "resistance") {
  const pool = levels.filter((l) => (kind === "resistance" ? l.price >= price : l.price <= price));
  return pool.sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price))[0];
}

export function detectDivergence(c: Candle[], osc: (number | null)[]) {
  if (c.length < 30 || osc.length < 30) return { bullish: false, bearish: false, hiddenBull: false, hiddenBear: false };
  const { highs, lows } = swings(c, 2, 2);
  const lastH = highs.slice(-2);
  const lastL = lows.slice(-2);
  const oscAt = (i: number) => {
    for (let k = i; k >= 0; k--) if (osc[k] != null) return osc[k]!;
    return null;
  };
  let bearish = false;
  let bullish = false;
  let hiddenBear = false;
  let hiddenBull = false;
  if (lastH.length === 2) {
    const p1 = lastH[0]!.price;
    const p2 = lastH[1]!.price;
    const o1 = oscAt(lastH[0]!.i);
    const o2 = oscAt(lastH[1]!.i);
    if (o1 != null && o2 != null) {
      if (p2 > p1 && o2 < o1) bearish = true;
      if (p2 < p1 && o2 > o1) hiddenBear = true;
    }
  }
  if (lastL.length === 2) {
    const p1 = lastL[0]!.price;
    const p2 = lastL[1]!.price;
    const o1 = oscAt(lastL[0]!.i);
    const o2 = oscAt(lastL[1]!.i);
    if (o1 != null && o2 != null) {
      if (p2 < p1 && o2 > o1) bullish = true;
      if (p2 > p1 && o2 < o1) hiddenBull = true;
    }
  }
  return { bullish, bearish, hiddenBull, hiddenBear };
}
