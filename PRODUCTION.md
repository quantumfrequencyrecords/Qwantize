# Production — GitHub Pages

Qwantize is a **static browser app**. GitHub Pages can host it. There is no server, no database, and no login.

Live URL:

`https://quantumfrequencyrecords.github.io/Qwantize/`

## 1. Enable GitHub Pages (required — one-time)

This repository is already configured for **Deploy from a branch**, source **main**, folder **`/` (root)**. That is the correct setting.

If you ever reset Pages:

1. Open [https://github.com/quantumfrequencyrecords/Qwantize/settings/pages](https://github.com/quantumfrequencyrecords/Qwantize/settings/pages)
2. **Build and deployment → Source:** **Deploy from a branch**
3. **Branch:** `main`
4. **Folder:** `/ (root)` — not `/docs` (root already contains the built `index.html` + `assets/`)
5. Click **Save**
6. Wait 1–2 minutes, then hard-refresh the live URL

The site must load `./assets/*.js`. If you see a white screen, view-source and confirm `index.html` contains a `<script type="module" src="./assets/...">` tag — not `/src/spa-entry.tsx`.

Hash routes: `#/`, `#/scanner`, `#/watchlist`, `#/charts`, `#/indicators`, `#/setups`, `#/news`, `#/alerts`, `#/settings`.

### Optional: GitHub Actions

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) rebuilds on push. To use it, switch Pages Source to **GitHub Actions**.

## 2. Add free API keys (in the app, not in Git)

1. Open the live site → **Settings**
2. Paste keys into:
   - **Finnhub** — [finnhub.io](https://finnhub.io) (news + candles, ~60/min free)
   - **Twelve Data** — [twelvedata.com](https://twelvedata.com) (many timeframes, ~800/day free)
   - **Alpha Vantage** — [alphavantage.co](https://www.alphavantage.co) (~25/day free)
   - **Financial Modeling Prep** — [financialmodelingprep.com](https://financialmodelingprep.com)
3. Keys are stored in **this browser’s `localStorage` only**. They are never uploaded.

Do **not** put keys in GitHub secrets, `.env` files, or source.

Yahoo / Stooq / Google News stay **off** unless you check “Attempt public feeds” in Settings. Those unofficial endpoints are often blocked by CORS.

## 3. What “production ready” means here

| Check | How |
| --- | --- |
| App loads on Pages | Dark dashboard, not a white page |
| Hash routes | `#/scanner`, `#/settings`, etc. |
| Analyze a ticker | Type `AAPL` → Analyze |
| Demo fallback | If keys are empty, a **demo / delayed** banner appears; indicators still run |
| Live data | With a Finnhub or Twelve Data key, banner disappears when a provider succeeds |
| Persistence | Refresh: watchlist, settings, and last symbol remain |

## 4. CORS and failed providers

Browsers block many market APIs from GitHub Pages (`*.github.io`). That is expected.

- Enable 1–2 free keyed providers (Finnhub first)
- Leave public Yahoo/Stooq off unless you accept failed requests
- Provider health is on **Settings → Data providers**
- Failover is automatic. If all fail, demo data is used and labeled

## 5. Rebuild

```bash
npm install
npm run build
```

Copy `docs/app.html` → `docs/index.html` and to the repo root `index.html` / `404.html`, and copy `docs/assets` to repo-root `assets/` if Pages is still serving from `/` (root).

Keep `base: "./"` in `vite.config.ts`.

## 6. Verify after deploy

```bash
curl -sI https://quantumfrequencyrecords.github.io/Qwantize/ | head
curl -sI https://quantumfrequencyrecords.github.io/Qwantize/assets/index.pages-CzoZUzg6.js | head
```

You want HTTP 200. If `index.html` still points at `/src/spa-entry.tsx`, Pages is serving the Vite source file — the production `index.html` at repo root was overwritten.

## Disclaimer

Educational decision-support only. Not a broker, not advice, not a signal service. You still make every trade.
