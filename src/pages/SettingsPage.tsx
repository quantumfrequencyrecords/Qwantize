import { AppLink } from "@/components/AppLink";
import { Panel, Tone } from "@/components/widgets";
import { API_KEY_WARNING, DISCLAIMER, PROVIDER_META } from "@/lib/quant/config";
import { getHealthSnapshot } from "@/lib/quant/providers";
import { useQuant } from "@/lib/quant/store";

export function SettingsPage() {
  const { settings, patchSettings, restoreDefaults, clearKeys, health, snapshots } = useQuant();
  const liveHealth = health.length ? health : getHealthSnapshot();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-medium tracking-tight">Settings</h1>

      <Panel title="API keys">
        <p className="text-sm text-warn">{API_KEY_WARNING}</p>
        <div className="mt-4 space-y-3">
          {PROVIDER_META.filter((p) => p.needsKey).map((p) => (
            <label key={p.id} className="block text-sm">
              {p.name}
              <input
                type="password"
                autoComplete="off"
                className="mt-1 h-11 w-full rounded-md border border-border bg-elevated px-3 font-mono text-sm"
                value={settings.keys[p.id] ?? ""}
                placeholder="Stored only in this browser"
                onChange={(e) => patchSettings({ keys: { ...settings.keys, [p.id]: e.target.value.trim() } })}
              />
            </label>
          ))}
        </div>
        <button type="button" className="mt-4 h-10 rounded-md border border-bear/40 bg-bear-dim px-4 text-sm text-bear" onClick={() => clearKeys()}>
          Clear all API keys
        </button>
        <ul className="mt-4 space-y-1 text-xs text-muted">
          <li>Finnhub — finnhub.io (free: 60 calls/min, news + candles)</li>
          <li>Twelve Data — twelvedata.com (free: 800/day, many timeframes)</li>
          <li>Alpha Vantage — alphavantage.co (free: 25/day)</li>
          <li>Financial Modeling Prep — financialmodelingprep.com</li>
          <li>Yahoo / Stooq need no key. Enable “public feeds” below if you want the app to try them (browser CORS often blocks these).</li>
        </ul>
      </Panel>

      <Panel title="Data providers">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="pb-2">Provider</th>
                <th className="pb-2">Enabled</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Health</th>
              </tr>
            </thead>
            <tbody>
              {PROVIDER_META.map((p, i) => {
                const h = liveHealth.find((x) => x.id === p.id);
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-2">
                      <div>{p.name}</div>
                      <div className="text-xs text-muted">Priority {i + 1} · {p.rateLimit}</div>
                    </td>
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={settings.enabledProviders[p.id] !== false}
                        onChange={(e) =>
                          patchSettings({ enabledProviders: { ...settings.enabledProviders, [p.id]: e.target.checked } })
                        }
                      />
                    </td>
                    <td className="py-2">
                      <Tone
                        tone={h?.status === "online" ? "bull" : h?.status === "failed" ? "bear" : h?.status === "limited" ? "warn" : "neutral"}
                      >
                        {h?.status ?? "idle"}
                      </Tone>
                    </td>
                    <td className="py-2 font-mono">{h?.healthScore ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={settings.allowPublicFeeds}
              onChange={(e) => patchSettings({ allowPublicFeeds: e.target.checked })}
            />
            <span>
              Attempt public Yahoo / Stooq / Google News feeds (no API key). These unofficial endpoints are often blocked by CORS in the browser. Leave off unless you are okay with failed network requests.
            </span>
          </label>
        </div>
      </Panel>

      <Panel title="Trading mode">
        <div className="flex flex-wrap gap-2">
          {(["day", "swing", "position"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => patchSettings({ mode: m })}
              className={`h-10 rounded-md px-4 text-sm ${settings.mode === m ? "bg-accent text-accent-fg" : "border border-border bg-elevated"}`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["beginner", "advanced"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => patchSettings({ uiMode: m })}
              className={`h-10 rounded-md px-4 text-sm ${settings.uiMode === m ? "bg-accent text-accent-fg" : "border border-border bg-elevated"}`}
            >
              {m} view
            </button>
          ))}
          {(["dark", "light"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => patchSettings({ theme: m })}
              className={`h-10 rounded-md px-4 text-sm ${settings.theme === m ? "bg-accent text-accent-fg" : "border border-border bg-elevated"}`}
            >
              {m}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Timeframe weights">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Object.entries(settings.timeframeWeights).map(([tf, w]) => (
            <label key={tf} className="text-xs">
              {tf}
              <input
                type="number"
                step="0.01"
                className="mt-1 h-9 w-full rounded-md border border-border bg-elevated px-2 font-mono"
                value={w}
                onChange={(e) => patchSettings({ timeframeWeights: { ...settings.timeframeWeights, [tf]: +e.target.value } })}
              />
            </label>
          ))}
        </div>
      </Panel>

      <Panel title="Indicator category weights">
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(settings.indicatorWeights).map(([k, w]) => (
            <label key={k} className="text-xs capitalize">
              {k} ({Math.round(w * 100)}%)
              <input
                type="range"
                min={0}
                max={40}
                value={Math.round(w * 100)}
                onChange={(e) =>
                  patchSettings({ indicatorWeights: { ...settings.indicatorWeights, [k]: Number(e.target.value) / 100 } })
                }
              />
            </label>
          ))}
        </div>
      </Panel>

      <Panel title="ADX thresholds">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Object.entries(settings.adxThresholds).map(([k, v]) => (
            <label key={k} className="text-xs">
              {k}
              <input
                type="number"
                className="mt-1 h-9 w-full rounded-md border border-border bg-elevated px-2"
                value={v}
                onChange={(e) => patchSettings({ adxThresholds: { ...settings.adxThresholds, [k]: +e.target.value } })}
              />
            </label>
          ))}
        </div>
      </Panel>

      <Panel title="Signal decay">
        <label className="text-sm">
          Lambda ({settings.signalDecayLambda})
          <input
            type="range"
            min={1}
            max={20}
            value={Math.round(settings.signalDecayLambda * 100)}
            onChange={(e) => patchSettings({ signalDecayLambda: Number(e.target.value) / 100 })}
          />
        </label>
      </Panel>

      <Panel title="Saved snapshots">
        {!snapshots.length ? <p className="text-sm text-muted">No snapshots yet.</p> : null}
        <ul className="space-y-2 text-sm">
          {snapshots.map((s) => (
            <li key={s.id} className="flex justify-between gap-3 font-mono">
              <span>
                {s.symbol} · {new Date(s.timestamp).toLocaleString()}
              </span>
              <span>
                {s.bias} · {Math.round(s.setupQuality)}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="h-10 rounded-md border border-border bg-elevated px-4 text-sm" onClick={() => restoreDefaults()}>
          Restore defaults
        </button>
        <AppLink to="/" className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg">
          Back to dashboard
        </AppLink>
      </div>
      <p className="text-xs leading-relaxed text-subtle">{DISCLAIMER}</p>
    </div>
  );
}
