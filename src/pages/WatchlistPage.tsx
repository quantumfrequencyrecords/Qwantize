import { useState } from "react";
import { AppLink } from "@/components/AppLink";
import { Panel, Tone } from "@/components/widgets";
import { prettyBias, toneFor } from "@/lib/quant/format";
import { useQuant } from "@/lib/quant/store";

export function WatchlistPage() {
  const { watchlist, addWatch, removeWatch, scanner, runScanner, scanning, analyze } = useQuant();
  const [sym, setSym] = useState("");
  const bySym = Object.fromEntries(scanner.map((a) => [a.symbol, a]));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-medium tracking-tight">Watchlist</h1>
      <Panel>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addWatch(sym);
            setSym("");
          }}
        >
          <input
            className="h-11 flex-1 rounded-md border border-border bg-elevated px-3 font-mono"
            value={sym}
            onChange={(e) => setSym(e.target.value.toUpperCase())}
            placeholder="Add ticker"
          />
          <button className="h-11 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg" type="submit">
            Add
          </button>
        </form>
        <button
          type="button"
          className="mt-3 h-10 rounded-md border border-border bg-elevated px-4 text-sm"
          disabled={scanning}
          onClick={() => void runScanner(watchlist.map((w) => w.symbol))}
        >
          {scanning ? "Updating…" : "Refresh statuses"}
        </button>
      </Panel>
      <Panel>
        <ul className="divide-y divide-border">
          {watchlist.map((w) => {
            const a = bySym[w.symbol];
            return (
              <li key={w.symbol} className="flex items-center justify-between gap-3 py-3">
                <AppLink to="/" className="font-mono text-lg" onClick={() => void analyze(w.symbol)}>
                  {w.symbol}
                </AppLink>
                <div className="flex items-center gap-3">
                  {a ? (
                    <>
                      <Tone tone={toneFor(a.bias)}>{prettyBias(a.bias)}</Tone>
                      <span className="font-mono text-sm">{Math.round(a.setupQuality)}</span>
                    </>
                  ) : (
                    <span className="text-xs text-muted">Not scanned</span>
                  )}
                  <button type="button" className="text-xs text-muted hover:text-bear" onClick={() => removeWatch(w.symbol)}>
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
