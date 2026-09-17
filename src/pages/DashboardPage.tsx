import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search } from "lucide-react";
import { PriceChart } from "@/components/PriceChart";
import { BiasChip, Meter, Panel, ScoreRing, SignalDot, SkeletonBlock, Tone } from "@/components/widgets";
import { DISCLAIMER } from "@/lib/quant/config";
import { fmtAgo, fmtNum, fmtPct, fmtPrice, fmtVol, prettyBias, toneFor } from "@/lib/quant/format";
import { lastUpdatedEt, sessionLabel } from "@/lib/quant/marketHours";
import { useQuant } from "@/lib/quant/store";
import { cn } from "@/lib/utils";

export function DashboardPage() {
  const { settings, symbol, setSymbol, analyze, analysis, loading, error, saveSnap, patchSettings } = useQuant();
  const [draft, setDraft] = useState(symbol);

  useEffect(() => {
    setDraft(symbol);
  }, [symbol]);

  useEffect(() => {
    if (!analysis && !loading) void analyze("SPY");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!settings.autoRefreshSec) return;
    const id = window.setInterval(() => {
      if (!loading) void analyze();
    }, settings.autoRefreshSec * 1000);
    return () => window.clearInterval(id);
  }, [settings.autoRefreshSec, analyze, loading]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const t = draft.trim().toUpperCase();
    if (!t) return;
    setSymbol(t);
    void analyze(t);
  }

  const a = analysis;
  const chartTf = settings.chartTimeframe;
  const chartCandles = a?.candles[chartTf] ?? a?.candles["15m"] ?? a?.candles["1D"] ?? [];

  const exportPayload = useMemo(() => {
    if (!a) return "";
    return JSON.stringify(a, null, 2);
  }, [a]);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-4 md:px-6 md:py-6">
      <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 shadow-panel md:flex-row md:items-center md:p-4">
        <label className="sr-only" htmlFor="ticker">
          Ticker
        </label>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            id="ticker"
            value={draft}
            onChange={(e) => setDraft(e.target.value.toUpperCase())}
            placeholder="SPY, AAPL, NVDA"
            className="h-11 w-full rounded-md border border-border bg-elevated pl-10 pr-3 font-mono text-sm tracking-wide outline-none focus:border-accent"
            autoCapitalize="characters"
            autoComplete="off"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="h-11 min-w-28 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg">
            Analyze
          </button>
          <button
            type="button"
            onClick={() => void analyze()}
            className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-elevated px-4 text-sm"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            Refresh
          </button>
          <select
            className="h-11 rounded-md border border-border bg-elevated px-3 text-sm"
            value={settings.autoRefreshSec}
            onChange={(e) => patchSettings({ autoRefreshSec: Number(e.target.value) })}
            aria-label="Auto refresh"
          >
            <option value={0}>Refresh off</option>
            <option value={15}>15s</option>
            <option value={30}>30s</option>
            <option value={60}>60s</option>
            <option value={120}>2m</option>
            <option value={300}>5m</option>
          </select>
        </div>
      </form>

      {error ? (
        <div className="rounded-xl border border-bear/40 bg-bear-dim px-4 py-3 text-sm text-bear" role="alert">
          {error}
        </div>
      ) : null}

      {loading && !a ? <LoadingGrid /> : null}

      {a ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
            <Panel>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs tracking-[0.16em] text-muted uppercase">{a.quote.name ?? "US EQUITY"}</div>
                  <div className="mt-1 font-mono text-3xl font-medium tracking-tight md:text-4xl">{a.symbol}</div>
                  <div className="mt-2 font-mono text-2xl tabular-nums">{fmtPrice(a.quote.price)}</div>
                  <div className={cn("mt-1 font-mono text-sm tabular-nums", a.quote.change >= 0 ? "text-bull" : "text-bear")}>
                    {fmtPrice(a.quote.change)} ({fmtPct(a.quote.changePercent)})
                  </div>
                </div>
                <div className="text-right text-xs text-muted">
                  <div className="font-medium text-fg">{sessionLabel(a.quote.marketStatus)}</div>
                  <div className="mt-1">{lastUpdatedEt(a.quote.timestamp)}</div>
                  <div className="mt-3">
                    Data quality <span className="font-mono text-fg">{a.dataQuality}</span>/100
                  </div>
                  <div className="mt-1">via {a.quote.provider}</div>
                </div>
              </div>
            </Panel>

            <Panel>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <div className="text-xs tracking-[0.14em] text-muted uppercase">Overall trend</div>
                  <div className="mt-2">
                    <BiasChip value={a.bias} />
                  </div>
                  <ScoreRing score={a.trendScore} label="Trend score" />
                </div>
                <div>
                  <div className="text-xs tracking-[0.14em] text-muted uppercase">Setup quality</div>
                  <div className="mt-2 font-mono text-3xl font-medium tabular-nums">{Math.round(a.setupQuality)}</div>
                  <Tone tone={a.grade === "LOW" ? "warn" : a.grade.startsWith("A") ? "bull" : "neutral"}>GRADE {a.grade}</Tone>
                </div>
                <div>
                  <div className="text-xs tracking-[0.14em] text-muted uppercase">Confidence</div>
                  <div className="mt-2 font-mono text-3xl font-medium tabular-nums">{Math.round(a.confidence)}</div>
                  <div className="text-xs text-muted">Score / 100 — not probability</div>
                </div>
                <div>
                  <div className="text-xs tracking-[0.14em] text-muted uppercase">Day-trade bias</div>
                  <div className="mt-2">
                    <Tone tone={toneFor(a.dayTradeBias)}>{a.dayTradeBias}</Tone>
                  </div>
                  <div className="mt-2 text-xs text-muted">{a.status}</div>
                </div>
              </div>
            </Panel>
          </div>

          {a.warnings.length ? (
            <div className="grid gap-2">
              {a.warnings.map((w) => (
                <div
                  key={w.code}
                  className={cn(
                    "rounded-xl border px-4 py-3 text-sm",
                    w.severity === "critical" ? "border-bear/40 bg-bear-dim text-fg" : "border-warn/40 bg-warn-dim text-fg",
                  )}
                  role="status"
                >
                  <div className="text-xs font-medium tracking-[0.12em] uppercase">{w.title}</div>
                  <p className="mt-1 text-muted">{w.detail}</p>
                </div>
              ))}
            </div>
          ) : null}

          <Panel title="Multi-timeframe alignment" action={<span className="font-mono text-xs text-muted">{a.alignment}/100</span>}>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {a.mtf.map((t) => (
                <div key={t.timeframe} className="min-w-[72px] rounded-md border border-border bg-elevated px-3 py-2 text-center">
                  <div className="text-[10px] tracking-wide text-muted uppercase">{t.timeframe}</div>
                  <div className="mt-1 flex justify-center">
                    <SignalDot signal={t.available ? t.bias : "NEUTRAL"} />
                  </div>
                  <div className="mt-1 text-[10px] text-muted">{t.available ? t.bias.slice(0, 4) : "—"}</div>
                </div>
              ))}
            </div>
            {a.conflict.present ? (
              <p className="mt-3 text-sm text-warn">
                Short-term {a.conflict.shortTerm} vs higher-timeframe {a.conflict.higherTf}. {a.conflict.interpretation}
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted">Timeframes are broadly aligned.</p>
            )}
          </Panel>

          <Panel title="Key indicators">
            <div className="grid gap-3 md:grid-cols-2">
              {a.keyIndicators.map((ind) => (
                <div key={ind.name} className="rounded-md border border-border bg-elevated px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{ind.name}</div>
                    <Tone tone={toneFor(ind.signal)}>{ind.signal}</Tone>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <div className="font-mono text-lg tabular-nums">{typeof ind.value === "number" ? fmtNum(ind.value, 2) : ind.value}</div>
                    <div className="font-mono text-xs text-muted">
                      {ind.score >= 0 ? "+" : ""}
                      {Math.round(ind.score)}
                    </div>
                  </div>
                  <div className="mt-2">
                    <Meter value={ind.score} tone={toneFor(ind.signal)} />
                  </div>
                  {settings.uiMode === "advanced" ? <p className="mt-2 text-xs text-muted">{ind.explanation}</p> : null}
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Price chart"
            action={
              <select
                className="h-9 rounded-md border border-border bg-elevated px-2 text-xs"
                value={settings.chartTimeframe}
                onChange={(e) => patchSettings({ chartTimeframe: e.target.value as typeof settings.chartTimeframe })}
                aria-label="Chart timeframe"
              >
                {["5m", "15m", "30m", "1h", "4h", "1D"].map((tf) => (
                  <option key={tf} value={tf}>
                    {tf}
                  </option>
                ))}
              </select>
            }
          >
            <PriceChart candles={chartCandles} levels={a.levels} vwap={a.bundles[chartTf]?.vwap ?? a.bundles["15m"]?.vwap} />
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Support / resistance">
              <ul className="space-y-2">
                {a.levels.slice(0, 8).map((l) => (
                  <li key={`${l.label}-${l.price}`} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <div className="font-medium">{l.label}</div>
                      <div className="text-xs text-muted">{l.sources.join(" · ")}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono tabular-nums">{fmtPrice(l.price)}</div>
                      <Tone tone={l.kind === "resistance" ? "bear" : l.kind === "support" ? "bull" : "neutral"}>{l.kind}</Tone>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Setup engine">
              <div className="flex items-center gap-2">
                <Tone tone={a.primarySetup.noTrade ? "warn" : toneFor(a.primarySetup.direction)}>{a.primarySetup.grade} SETUP</Tone>
                <span className="text-sm">{a.primarySetup.type}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <KV k="Quality" v={`${Math.round(a.primarySetup.quality)}/100`} />
                <KV k="Direction" v={a.primarySetup.direction} />
                <KV
                  k="Entry zone"
                  v={
                    a.primarySetup.entryLow != null
                      ? `${fmtPrice(a.primarySetup.entryLow)} – ${fmtPrice(a.primarySetup.entryHigh)}`
                      : "—"
                  }
                />
                <KV k="Invalidation" v={fmtPrice(a.primarySetup.stop)} />
                {a.primarySetup.targets.map((t) => (
                  <KV key={t.label} k={`${t.label}${t.rr ? ` · ${t.rr.toFixed(1)}R` : ""}`} v={fmtPrice(t.price)} />
                ))}
              </div>
              {a.primarySetup.noTrade ? <p className="mt-3 text-sm text-warn">{a.primarySetup.noTradeReason}</p> : null}
              <div className="mt-4">
                <div className="text-xs tracking-[0.14em] text-muted uppercase">Checklist</div>
                <ul className="mt-2 grid grid-cols-2 gap-1 text-sm">
                  {a.primarySetup.checklist.map((c) => (
                    <li key={c.label} className={c.ok ? "text-bull" : "text-muted"}>
                      {c.ok ? "✓" : "–"} {c.label}
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          </div>

          <Panel title="Why this reading?">
            <div className="grid gap-2 md:grid-cols-2">
              {a.categories.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className="rounded-md border border-border bg-elevated px-3 py-3 text-left"
                  title={c.explanation}
                >
                  <div className="flex justify-between text-sm">
                    <span>{c.label}</span>
                    <span className="font-mono tabular-nums">
                      {c.awarded.toFixed(0)}/{c.max}
                    </span>
                  </div>
                  <div className="mt-2">
                    <Meter value={c.awarded} max={c.max} />
                  </div>
                  {settings.uiMode === "advanced" ? <p className="mt-2 text-xs text-muted">{c.explanation}</p> : null}
                </button>
              ))}
            </div>
            <ul className="mt-4 space-y-1 text-sm text-muted">
              {a.primarySetup.reasons.map((r) => (
                <li key={r}>+ {r}</li>
              ))}
              {a.primarySetup.risks.map((r) => (
                <li key={r} className="text-warn">
                  ! {r}
                </li>
              ))}
            </ul>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="News" action={<span className="text-xs text-muted">{a.newsSentiment.overall}</span>}>
              <div className="mb-3 flex gap-3 text-xs text-muted">
                <span>Bull {a.newsSentiment.bullish}</span>
                <span>Bear {a.newsSentiment.bearish}</span>
                <span>Neutral {a.newsSentiment.neutral}</span>
              </div>
              <ul className="space-y-3">
                {a.news.slice(0, 5).map((n) => (
                  <li key={n.id}>
                    <a href={n.url} target="_blank" rel="noreferrer" className="text-sm hover:text-accent">
                      {n.headline}
                    </a>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                      <Tone tone={toneFor(n.sentiment)}>{n.sentiment}</Tone>
                      <span>{n.source}</span>
                      <span>{fmtAgo(n.timestamp)}</span>
                      <span>{n.impact} impact</span>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Market context">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <KV k="Regime" v={a.regime} />
                <KV k="Tape" v={a.marketContext.label} />
                <KV k="SPY" v={a.marketContext.spyBias} />
                <KV k="QQQ" v={a.marketContext.qqqBias} />
                <KV k="IWM" v={a.marketContext.iwmBias} />
                <KV k="vs SPY" v={a.marketContext.relativeVsSpy == null ? "—" : fmtPct(a.marketContext.relativeVsSpy)} />
                <KV k="Gap" v={`${a.gap.kind} ${fmtPct(a.gap.pct)}`} />
                <KV k="Expected move" v={`${fmtPrice(a.expectedMove.value)} (${a.expectedMove.source})`} />
                <KV k="Volume" v={fmtVol(a.quote.volume)} />
                <KV k="Sector ETF" v={a.marketContext.sector ?? "—"} />
              </div>
            </Panel>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => saveSnap()} className="h-10 rounded-md border border-border bg-elevated px-4 text-sm">
              Save analysis snapshot
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-elevated px-4 text-sm"
              onClick={() => {
                const blob = new Blob([exportPayload], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const l = document.createElement("a");
                l.href = url;
                l.download = `${a.symbol}-qwantize.json`;
                l.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="size-4" />
              Export JSON
            </button>
            <button
              type="button"
              className="h-10 rounded-md border border-border bg-elevated px-4 text-sm"
              onClick={() => {
                const rows = [
                  ["field", "value"],
                  ["symbol", a.symbol],
                  ["price", String(a.quote.price)],
                  ["bias", a.bias],
                  ["trendScore", String(a.trendScore)],
                  ["setupQuality", String(a.setupQuality)],
                  ["confidence", String(a.confidence)],
                  ["grade", a.grade],
                  ["setup", a.primarySetup.type],
                ];
                const csv = rows.map((r) => r.join(",")).join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const l = document.createElement("a");
                l.href = url;
                l.download = `${a.symbol}-qwantize.csv`;
                l.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export CSV
            </button>
            <button type="button" onClick={() => window.print()} className="h-10 rounded-md border border-border bg-elevated px-4 text-sm">
              Print analysis
            </button>
          </div>
        </>
      ) : null}

      <p className="max-w-3xl text-xs leading-relaxed text-subtle">{DISCLAIMER}</p>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md bg-elevated px-3 py-2">
      <div className="text-[10px] tracking-wide text-muted uppercase">{k}</div>
      <div className="mt-0.5 font-mono text-sm tabular-nums">{v}</div>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SkeletonBlock className="h-40" />
      <SkeletonBlock className="h-40" />
      <SkeletonBlock className="h-28 md:col-span-2" />
      <SkeletonBlock className="h-72 md:col-span-2" />
    </div>
  );
}

void prettyBias;
