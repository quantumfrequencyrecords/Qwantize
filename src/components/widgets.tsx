import { cn } from "@/lib/utils";
import { prettyBias, toneFor } from "@/lib/quant/format";
import type { Signal } from "@/lib/quant/types";

export function Tone({
  tone,
  children,
  className,
}: {
  tone: "bull" | "bear" | "warn" | "neutral";
  children: React.ReactNode;
  className?: string;
}) {
  const map = {
    bull: "text-bull bg-bull-dim",
    bear: "text-bear bg-bear-dim",
    warn: "text-warn bg-warn-dim",
    neutral: "text-muted bg-elevated",
  };
  return (
    <span className={cn("inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium tracking-wide", map[tone], className)}>
      {children}
    </span>
  );
}

export function BiasChip({ value }: { value: string }) {
  return <Tone tone={toneFor(value)}>{prettyBias(value as never).replaceAll("_", " ")}</Tone>;
}

export function SignalDot({ signal }: { signal: Signal | string }) {
  const t = toneFor(signal);
  const color = t === "bull" ? "bg-bull" : t === "bear" ? "bg-bear" : t === "warn" ? "bg-warn" : "bg-muted";
  const label = typeof signal === "string" ? signal : "NEUTRAL";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", color)} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Meter({ value, max = 100, tone }: { value: number; max?: number; tone?: "bull" | "bear" | "warn" | "neutral" }) {
  const pct = Math.max(0, Math.min(100, (Math.abs(value) / max) * 100));
  const t = tone ?? (value >= 15 ? "bull" : value <= -15 ? "bear" : "neutral");
  const bar = t === "bull" ? "bg-bull" : t === "bear" ? "bg-bear" : t === "warn" ? "bg-warn" : "bg-muted";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-elevated" aria-hidden>
      <div className={cn("h-full rounded-full", bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-surface p-4 shadow-panel md:p-5", className)}>
      {(title || action) && (
        <header className="mb-3 flex items-end justify-between gap-3">
          {title ? <h2 className="text-xs font-medium tracking-[0.14em] text-muted uppercase">{title}</h2> : <span />}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function ScoreRing({ score, label }: { score: number; label: string }) {
  const t = score >= 15 ? "text-bull" : score <= -15 ? "text-bear" : "text-muted";
  return (
    <div className="flex flex-col items-start gap-1">
      <div className={cn("font-mono text-3xl font-medium tabular-nums tracking-tight", t)}>
        {score >= 0 ? "+" : ""}
        {Math.round(score)}
        <span className="text-sm text-muted"> / 100</span>
      </div>
      <div className="text-xs tracking-wide text-muted uppercase">{label}</div>
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("q-shimmer rounded-md", className)} />;
}
