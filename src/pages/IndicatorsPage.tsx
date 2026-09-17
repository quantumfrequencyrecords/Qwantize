import { Panel, SignalDot, Tone } from "@/components/widgets";
import { fmtNum } from "@/lib/quant/format";
import { toneFor } from "@/lib/quant/format";
import { useQuant } from "@/lib/quant/store";

const NAMES = ["RSI", "MACD", "ADX", "EMA", "VWAP", "VOLUME"];

export function IndicatorsPage() {
  const a = useQuant((s) => s.analysis);
  const tfs = a?.mtf.map((t) => t.timeframe) ?? [];
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-medium tracking-tight">Indicator matrix</h1>
      {!a ? (
        <p className="text-sm text-muted">Analyze a symbol first.</p>
      ) : (
        <>
          <Panel>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-xs tracking-wide text-muted uppercase">
                    <th className="pb-2">Indicator</th>
                    {tfs.map((tf) => (
                      <th key={tf} className="pb-2">
                        {tf}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {NAMES.map((name) => (
                    <tr key={name} className="border-t border-border">
                      <td className="py-2 font-medium">{name}</td>
                      {tfs.map((tf) => {
                        const r = a.bundles[tf]?.readings.find((x) => x.name === name);
                        return (
                          <td key={tf} className="py-2">
                            {r ? (
                              <span className="inline-flex items-center gap-2">
                                <SignalDot signal={r.signal} />
                                <span className="font-mono text-xs">{typeof r.value === "number" ? fmtNum(r.value, 1) : r.value}</span>
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <div className="grid gap-3 md:grid-cols-2">
            {a.keyIndicators.map((ind) => (
              <Panel key={ind.name} title={`${ind.name} analysis`}>
                <div className="flex items-center gap-2">
                  <Tone tone={toneFor(ind.signal)}>{ind.signal}</Tone>
                  <span className="font-mono">{typeof ind.value === "number" ? fmtNum(ind.value, 2) : ind.value}</span>
                </div>
                <p className="mt-3 text-sm text-muted">{ind.explanation}</p>
                <ul className="mt-3 space-y-1 text-sm">
                  {tfs.map((tf) => {
                    const r = a.bundles[tf]?.readings.find((x) => x.name === ind.name);
                    return (
                      <li key={tf} className="flex justify-between font-mono text-xs">
                        <span>{tf}</span>
                        <span>
                          {r ? `${typeof r.value === "number" ? fmtNum(r.value, 1) : r.value} · ${r.signal}` : "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
