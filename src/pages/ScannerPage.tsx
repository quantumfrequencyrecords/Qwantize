import { useState } from "react";
import { Panel, Tone } from "@/components/widgets";
import { SCANNER_UNIVERSE } from "@/lib/quant/config";
import { fmtPct, fmtPrice, prettyBias, toneFor } from "@/lib/quant/format";
import { useQuant } from "@/lib/quant/store";
import { AppLink } from "@/components/AppLink";

export function ScannerPage() {
  const { scanner, scanning, runScanner, analyze, watchlist } = useQuant();
  const [minSetup, setMinSetup] = useState(0);
  const [trend, setTrend] = useState<"any" | "bull" | "bear">("any");
  const [minRvol, setMinRvol] = useState(0);
  const [minAdx, setMinAdx] = useState(0);
  const [aboveVwap, setAboveVwap] = useState(false);
  const [custom, setCustom] = useState(watchlist.map((w) => w.symbol).join(" "));

  const rows = scanner
    .filter((a) => a.setupQuality >= minSetup)
    .filter((a) => (trend === "any" ? true : trend === "bull" ? a.trendScore > 15 : a.trendScore < -15))
    .filter((a) => (a.bundles["15m"]?.relVolume ?? a.bundles["1D"]?.relVolume ?? 0) >= minRvol)
    .filter((a) => (a.bundles["15m"]?.adx ?? a.bundles["1D"]?.adx ?? 0) >= minAdx)
    .filter((a) => {
      if (!aboveVwap) return true;
      const v = a.bundles["15m"]?.vwap ?? a.bundles["5m"]?.vwap;
      return v != null && a.quote.price >= v;
    })
    .sort((a, b) => b.setupQuality - a.setupQuality);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Opportunity scanner</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">Ranks symbols by setup quality. Uses your provider keys and falls back automatically.</p>
      </div>
      <Panel title="Universe">
        <textarea
          className="h-24 w-full rounded-md border border-border bg-elevated p-3 font-mono text-sm"
          value={custom}
          onChange={(e) => setCustom(e.target.value.toUpperCase())}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="h-10 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg"
            disabled={scanning}
            onClick={() => void runScanner(custom.split(/[\s,]+/).filter(Boolean))}
          >
            {scanning ? "Scanning…" : "Scan list"}
          </button>
          <button
            type="button"
            className="h-10 rounded-md border border-border bg-elevated px-4 text-sm"
            disabled={scanning}
            onClick={() => {
              setCustom(SCANNER_UNIVERSE.join(" "));
              void runScanner(SCANNER_UNIVERSE);
            }}
          >
            Scan default universe
          </button>
        </div>
      </Panel>
      <Panel title="Filters">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm">
            Setup score
            <input type="number" className="mt-1 h-10 w-full rounded-md border border-border bg-elevated px-2" value={minSetup} onChange={(e) => setMinSetup(+e.target.value)} />
          </label>
          <label className="text-sm">
            Trend
            <select className="mt-1 h-10 w-full rounded-md border border-border bg-elevated px-2" value={trend} onChange={(e) => setTrend(e.target.value as typeof trend)}>
              <option value="any">Any</option>
              <option value="bull">Bullish</option>
              <option value="bear">Bearish</option>
            </select>
          </label>
          <label className="text-sm">
            Min RVOL
            <input type="number" step="0.1" className="mt-1 h-10 w-full rounded-md border border-border bg-elevated px-2" value={minRvol} onChange={(e) => setMinRvol(+e.target.value)} />
          </label>
          <label className="text-sm">
            Min ADX
            <input type="number" className="mt-1 h-10 w-full rounded-md border border-border bg-elevated px-2" value={minAdx} onChange={(e) => setMinAdx(+e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={aboveVwap} onChange={(e) => setAboveVwap(e.target.checked)} />
            Price above VWAP
          </label>
        </div>
        <div className="mt-3 text-sm text-muted">{rows.length} symbols pass filters</div>
      </Panel>
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="pb-2">Rank</th>
                <th className="pb-2">Ticker</th>
                <th className="pb-2">Bias</th>
                <th className="pb-2">Setup</th>
                <th className="pb-2">Conf</th>
                <th className="pb-2">RVOL</th>
                <th className="pb-2">Price</th>
                <th className="pb-2">Setup type</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => (
                <tr key={a.symbol} className="border-t border-border">
                  <td className="py-2 font-mono">{i + 1}</td>
                  <td className="py-2">
                    <AppLink
                      to="/"
                      className="font-medium text-accent"
                      onClick={() => {
                        void analyze(a.symbol);
                      }}
                    >
                      {a.symbol}
                    </AppLink>
                  </td>
                  <td className="py-2">
                    <Tone tone={toneFor(a.bias)}>{prettyBias(a.bias)}</Tone>
                  </td>
                  <td className="py-2 font-mono">{Math.round(a.setupQuality)}</td>
                  <td className="py-2 font-mono">{Math.round(a.confidence)}</td>
                  <td className="py-2 font-mono">{(a.bundles["15m"]?.relVolume ?? a.bundles["1D"]?.relVolume ?? 0).toFixed(2)}x</td>
                  <td className="py-2 font-mono">
                    {fmtPrice(a.quote.price)} <span className={a.quote.changePercent >= 0 ? "text-bull" : "text-bear"}>{fmtPct(a.quote.changePercent)}</span>
                  </td>
                  <td className="py-2 text-muted">{a.primarySetup.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? <p className="py-8 text-center text-sm text-muted">Run a scan to rank opportunities.</p> : null}
        </div>
      </Panel>
    </div>
  );
}
