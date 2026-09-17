import { Panel } from "@/components/widgets";
import { useQuant } from "@/lib/quant/store";
import type { AlertRule } from "@/lib/quant/types";

const LABELS: Record<AlertRule["type"], string> = {
  setup_score: "Setup score above",
  breakout: "Bullish breakout",
  breakdown: "Bearish breakdown",
  rvol: "Relative volume above",
  vwap_cross: "Price crosses VWAP",
  macd_cross: "MACD bullish crossover",
  rsi_50: "RSI crosses 50",
  adx: "ADX above",
  support: "Price enters support zone",
  resistance: "Price enters resistance zone",
};

export function AlertsPage() {
  const { alerts, setAlerts } = useQuant();

  function patch(id: string, p: Partial<AlertRule>) {
    setAlerts(alerts.map((a) => (a.id === id ? { ...a, ...p } : a)));
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-medium tracking-tight">Alerts</h1>
      <p className="text-sm text-muted">Evaluated after each analysis / scan. Browser notifications are optional and stay on this device.</p>
      <button
        type="button"
        className="h-10 w-fit rounded-md border border-border bg-elevated px-4 text-sm"
        onClick={() => void Notification.requestPermission()}
      >
        Enable browser notifications
      </button>
      {alerts.map((a) => (
        <Panel key={a.id} title={LABELS[a.type]}>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={a.enabled} onChange={(e) => patch(a.id, { enabled: e.target.checked })} />
              Enabled
            </label>
            {["setup_score", "rvol", "adx"].includes(a.type) ? (
              <label className="flex items-center gap-2">
                Threshold
                <input
                  type="number"
                  className="h-9 w-24 rounded-md border border-border bg-elevated px-2"
                  value={a.threshold}
                  onChange={(e) => patch(a.id, { threshold: +e.target.value })}
                />
              </label>
            ) : null}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={a.notify} onChange={(e) => patch(a.id, { notify: e.target.checked })} />
              Browser notify
            </label>
          </div>
        </Panel>
      ))}
    </div>
  );
}
