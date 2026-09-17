import { Panel, Tone } from "@/components/widgets";
import { fmtAgo } from "@/lib/quant/format";
import { toneFor } from "@/lib/quant/format";
import { useQuant } from "@/lib/quant/store";

export function NewsPage() {
  const a = useQuant((s) => s.analysis);
  if (!a) return <div className="px-6 py-8 text-sm text-muted">Analyze a symbol to load news.</div>;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-medium tracking-tight">News</h1>
      <Panel title="Sentiment">
        <div className="flex gap-4 text-sm">
          <span>Bullish {a.newsSentiment.bullish}</span>
          <span>Bearish {a.newsSentiment.bearish}</span>
          <span>Neutral {a.newsSentiment.neutral}</span>
          <Tone tone={toneFor(a.newsSentiment.overall)}>{a.newsSentiment.overall}</Tone>
        </div>
        <p className="mt-2 text-xs text-muted">Low-impact headlines barely move the trading score. High-impact items (earnings, guidance, legal) weigh more, and older items decay.</p>
      </Panel>
      {a.news.map((n) => (
        <Panel key={n.id}>
          <a href={n.url} className="text-base hover:text-accent" target="_blank" rel="noreferrer">
            {n.headline}
          </a>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
            <Tone tone={toneFor(n.sentiment)}>{n.sentiment}</Tone>
            <span>{n.source}</span>
            <span>{fmtAgo(n.timestamp)}</span>
            <span>{n.category}</span>
            <span>{n.impact} impact</span>
          </div>
        </Panel>
      ))}
    </div>
  );
}
