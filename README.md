# Qwantize — Ultimate Quant Trader

Browser-only multi-timeframe stock analysis and day-trading **decision support**. No backend. No paid APIs required. Keys you add stay in this browser only.

**Live (GitHub Pages):** [https://quantumfrequencyrecords.github.io/Qwantize/](https://quantumfrequencyrecords.github.io/Qwantize/)

This is **not a broker, signal service, or financial advisor**. You still make every trade.

## What it does

- Dashboard with bias, setup quality, confluence, 1m–1W timeframes, S/R, VWAP, expected move, news, and trade plan
- Scanner over a default liquid-US universe (plus custom tickers)
- Watchlist, charts (candles + VWAP + S/R), 70+ indicators, setups, news, alerts
- Settings for API keys, provider failover, weights, ADX, decay, theme, beginner/advanced

## Quick start (local)

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173/Qwantize/`).

## GitHub Pages

The production static site is already in [`docs/`](docs/). Enable Pages:

1. Repo **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: **main**, folder: **/docs**
4. Save. Site: `https://quantumfrequencyrecords.github.io/Qwantize/`

Full steps, API keys, CORS, and verification: **[PRODUCTION.md](PRODUCTION.md)**

## Data

- Free keys (optional, stored in `localStorage` only): Finnhub, Twelve Data, Alpha Vantage, FMP
- Yahoo / Stooq / Google News: off by default (CORS often blocks them in the browser)
- If every live feed fails, the app labels **demo / delayed** data and still computes the full pipeline

Never commit API keys.

## Disclaimer

Educational decision-support only. Markets are risky. Past structure does not predict future results.
