import { PriceChart } from "@/components/PriceChart";
import { Panel } from "@/components/widgets";
import { useQuant } from "@/lib/quant/store";

export function ChartsPage() {
  const { analysis, settings, patchSettings } = useQuant();
  const tf = settings.chartTimeframe;
  const candles = analysis?.candles[tf] ?? analysis?.candles["1D"] ?? [];
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-medium tracking-tight">Charts</h1>
      <Panel
        title={analysis ? `${analysis.symbol} · ${tf}` : "No symbol analyzed"}
        action={
          <select
            className="h-9 rounded-md border border-border bg-elevated px-2 text-xs"
            value={tf}
            onChange={(e) => patchSettings({ chartTimeframe: e.target.value as typeof tf })}
          >
            {["1m", "5m", "15m", "30m", "1h", "4h", "1D", "1W"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        }
      >
        {candles.length ? (
          <PriceChart candles={candles} levels={analysis?.levels ?? []} vwap={analysis?.bundles[tf]?.vwap} />
        ) : (
          <p className="py-16 text-center text-sm text-muted">Analyze a ticker on the dashboard to load candles.</p>
        )}
      </Panel>
      <p className="text-xs text-muted">Overlays: candlesticks with support/resistance used as reference levels. Indicators are computed locally from OHLCV.</p>
    </div>
  );
}
