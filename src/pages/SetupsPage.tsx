import { Panel, Tone } from "@/components/widgets";
import { fmtPrice } from "@/lib/quant/format";
import { toneFor } from "@/lib/quant/format";
import { useQuant } from "@/lib/quant/store";

export function SetupsPage() {
  const a = useQuant((s) => s.analysis);
  if (!a) return <div className="px-6 py-8 text-sm text-muted">Analyze a symbol to see setups.</div>;
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-medium tracking-tight">Detected setups</h1>
      {a.setups.map((s) => (
        <Panel key={s.type} title={s.type}>
          <div className="flex flex-wrap items-center gap-2">
            <Tone tone={s.noTrade ? "warn" : toneFor(s.direction)}>{s.grade}</Tone>
            <Tone tone={toneFor(s.direction)}>{s.direction}</Tone>
            <span className="font-mono text-sm">{Math.round(s.quality)}/100</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div>Entry {s.entryLow != null ? `${fmtPrice(s.entryLow)} – ${fmtPrice(s.entryHigh)}` : "—"}</div>
            <div>Stop {fmtPrice(s.stop)}</div>
            {s.targets.map((t) => (
              <div key={t.label}>
                {t.label} {fmtPrice(t.price)} {t.rr ? `(${t.rr.toFixed(1)}R)` : ""}
              </div>
            ))}
          </div>
          {s.noTrade ? <p className="mt-3 text-sm text-warn">{s.noTradeReason}</p> : null}
          <ul className="mt-3 space-y-1 text-sm">
            {s.reasons.map((r) => (
              <li key={r}>+ {r}</li>
            ))}
            {s.risks.map((r) => (
              <li key={r} className="text-warn">
                ! {r}
              </li>
            ))}
          </ul>
          <ul className="mt-4 grid grid-cols-2 gap-1 text-sm">
            {s.checklist.map((c) => (
              <li key={c.label} className={c.ok ? "text-bull" : "text-muted"}>
                {c.ok ? "✓" : "–"} {c.label}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-subtle">Reference levels only — not trade instructions.</p>
        </Panel>
      ))}
    </div>
  );
}
