import { CandlestickSeries, ColorType, createChart, type IChartApi, type ISeriesApi, type IPriceLine } from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { Candle, SrLevel } from "@/lib/quant/types";

export function PriceChart({
  candles,
  levels,
  vwap,
}: {
  candles: Candle[];
  levels: SrLevel[];
  vwap?: number | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const api = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lines = useRef<IPriceLine[]>([]);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const styles = getComputedStyle(document.documentElement);
    const bg = styles.getPropertyValue("--color-surface").trim() || "#11151a";
    const fg = styles.getPropertyValue("--color-muted").trim() || "#8b95a1";
    const bull = styles.getPropertyValue("--color-bull").trim() || "#3dbe8c";
    const bear = styles.getPropertyValue("--color-bear").trim() || "#e05d5d";
    const border = styles.getPropertyValue("--color-border").trim() || "#232b34";
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: bg },
        textColor: fg,
        fontFamily: "IBM Plex Sans, sans-serif",
        attributionLogo: false,
      },
      grid: { vertLines: { color: border }, horzLines: { color: border } },
      rightPriceScale: { borderColor: border },
      timeScale: { borderColor: border, timeVisible: true },
      crosshair: { vertLine: { color: fg }, horzLine: { color: fg } },
    });
    const cs = chart.addSeries(CandlestickSeries, {
      upColor: bull,
      downColor: bear,
      borderUpColor: bull,
      borderDownColor: bear,
      wickUpColor: bull,
      wickDownColor: bear,
    });
    api.current = chart;
    series.current = cs;
    return () => {
      chart.remove();
      api.current = null;
      series.current = null;
      lines.current = [];
    };
  }, []);

  useEffect(() => {
    if (!series.current || !candles.length) return;
    series.current.setData(
      candles.map((c) => ({
        time: Math.floor(c.timestamp / 1000) as never,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    for (const l of lines.current) series.current.removePriceLine(l);
    lines.current = [];
    for (const l of levels.slice(0, 6)) {
      lines.current.push(
        series.current.createPriceLine({
          price: l.price,
          color: l.kind === "resistance" ? "#e05d5d" : l.kind === "support" ? "#3dbe8c" : "#8fb4c6",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: l.label,
        }),
      );
    }
    if (vwap) {
      lines.current.push(
        series.current.createPriceLine({
          price: vwap,
          color: "#8fb4c6",
          lineWidth: 1,
          title: "VWAP",
          axisLabelVisible: true,
        }),
      );
    }
    api.current?.timeScale().fitContent();
  }, [candles, levels, vwap]);

  return <div ref={ref} className="h-[320px] w-full md:h-[420px]" role="img" aria-label="Price chart" />;
}
