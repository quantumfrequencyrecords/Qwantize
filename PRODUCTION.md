# Production — GitHub Pages

Qwantize is a **static browser app**. GitHub Pages can host it. There is no server, no database, and no login.

Live URL after Pages is enabled:

`https://quantumfrequencyrecords.github.io/Qwantize/`

## 1. Enable GitHub Pages (required — one-time)

The repo already contains a built site in `/docs`. GitHub will **not** serve it until you turn Pages on.

1. Open [https://github.com/quantumfrequencyrecords/Qwantize](https://github.com/quantumfrequencyrecords/Qwantize)
2. **Settings** → **Pages** (left sidebar, under Code and automation)
3. **Build and deployment → Source:** choose **Deploy from a branch**
4. **Branch:** `main`
5. **Folder:** `/docs`
6. Click **Save**
7. Wait 1–2 minutes. The Pages URL appears on that same screen.

Open:

`https://quantumfrequencyrecords.github.io/Qwantize/`

If you see a 404:

- Confirm `docs/index.html` exists on `main`
- Confirm the folder is **/docs**, not `/ (root)`
- Hard-refresh (`Cmd-Shift-R` / `Ctrl-Shift-R`)
- Hash routes are used (`#/scanner`, `#/settings`). The homepage is `#/`

### Optional: GitHub Actions

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) rebuilds `docs/` on every push to `main`.

To use it instead of “Deploy from a branch”:

1. Settings → Pages → Source: **GitHub Actions**
2. Actions tab → **Deploy GitHub Pages** → confirm the workflow ran green

## 2. Add free API keys (in the app, not in Git)

1. Open the live site → **Settings**
2. Paste keys into:
   - **Finnhub** — [finnhub.io](https://finnhub.io) (news + candles, ~60/min free)
   - **Twelve Data** — [twelvedata.com](https://twelvedata.com) (many timeframes, ~800/day free)
   - **Alpha Vantage** — [alphavantage.co](https://www.alphavantage.co) (~25/day free)
   - **Financial Modeling Prep** — [financialmodelingprep.com](https://financialmodelingprep.com)
3. Keys are stored in **this browser’s `localStorage` only**. They are never uploaded.

Do **not** put keys in GitHub secrets, `.env` files, or source. This static site cannot keep a secret.

Yahoo / Stooq / Google News stay **off** unless you check “Attempt public feeds” in Settings. Those unofficial endpoints are often blocked by CORS.

## 3. What “production ready” means here

| Check | How |
| --- | --- |
| App loads on Pages | Open the Pages URL, dashboard appears |
| Hash routes | `#/scanner`, `#/watchlist`, `#/charts`, `#/indicators`, `#/setups`, `#/news`, `#/alerts`, `#/settings` |
| Analyze a ticker | Type `AAPL` (or another liquid US symbol) → Analyze |
| Demo fallback | If keys are empty, a **demo / delayed** banner appears; indicators still run |
| Live data | With a Finnhub or Twelve Data key, banner disappears when a provider succeeds |
| Persistence | Refresh the tab: watchlist, settings, and last symbol remain |
| Mobile | Thumb-reach search, 11px+ tap targets, bottom nav |

## 4. CORS and failed providers

Browsers block many market APIs from GitHub Pages (`*.github.io`). That is expected.

- Enable 1–2 free keyed providers (Finnhub first)
- Leave public Yahoo/Stooq off unless you accept failed requests
- Provider health is on **Settings → Data providers**
- Failover is automatic. If all fail, demo data is used and labeled

This is a GitHub Pages limitation, not a missing feature. A later proxy (Cloudflare Worker, etc.) is optional and not required for the app to function.

## 5. Rebuild the `docs/` site (maintainers)

```bash
npm install
npm run build
```

Vite writes into `docs/` with `base: "/Qwantize/"`. Commit the updated `docs/` assets if you use “Deploy from a branch”.

Do not change `base` unless the repository is renamed.

## 6. Verify after first deploy

```bash
curl -sI https://quantumfrequencyrecords.github.io/Qwantize/ | head
curl -sI https://quantumfrequencyrecords.github.io/Qwantize/assets/index-BzmqqOil.css | head
```

You want HTTP 200 (or 301/302 then 200). A persistent 404 means Pages is not pointed at `/docs`.

## Disclaimer

Educational decision-support only. Not a broker, not advice, not a signal service. You still make every trade.
