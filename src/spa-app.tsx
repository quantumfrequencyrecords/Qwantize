import {
  Activity,
  Bell,
  CandlestickChart,
  Compass,
  Gauge,
  LayoutDashboard,
  ListChecks,
  Newspaper,
  Settings,
  Star,
} from "lucide-react";
import { useEffect, useState } from "react";
import { APP_NAME, APP_TAGLINE } from "@/lib/quant/config";
import { getMarketSession, lastUpdatedEt, sessionLabel } from "@/lib/quant/marketHours";
import { useQuant } from "@/lib/quant/store";
import { cn } from "@/lib/utils";
import { AlertsPage } from "@/pages/AlertsPage";
import { ChartsPage } from "@/pages/ChartsPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { IndicatorsPage } from "@/pages/IndicatorsPage";
import { NewsPage } from "@/pages/NewsPage";
import { ScannerPage } from "@/pages/ScannerPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SetupsPage } from "@/pages/SetupsPage";
import { WatchlistPage } from "@/pages/WatchlistPage";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/scanner", label: "Scanner", icon: Compass },
  { to: "/watchlist", label: "Watchlist", icon: Star },
  { to: "/charts", label: "Charts", icon: CandlestickChart },
  { to: "/indicators", label: "Indicators", icon: Activity },
  { to: "/setups", label: "Setups", icon: ListChecks },
  { to: "/news", label: "News", icon: Newspaper },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
];

function currentPath() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function SpaApp() {
  const hydrate = useQuant((s) => s.hydrate);
  const ready = useQuant((s) => s.ready);
  const analysis = useQuant((s) => s.analysis);
  const [path, setPath] = useState(currentPath);
  const session = getMarketSession();

  useEffect(() => {
    hydrate();
    if (!window.location.hash) window.location.hash = "#/";
    const onHash = () => setPath(currentPath());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [hydrate]);

  const page = (() => {
    switch (path) {
      case "/scanner":
        return <ScannerPage />;
      case "/watchlist":
        return <WatchlistPage />;
      case "/charts":
        return <ChartsPage />;
      case "/indicators":
        return <IndicatorsPage />;
      case "/setups":
        return <SetupsPage />;
      case "/news":
        return <NewsPage />;
      case "/alerts":
        return <AlertsPage />;
      case "/settings":
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  })();

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg">
        Skip to analysis
      </a>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border bg-panel px-3 py-5 lg:flex">
          <div className="px-2 pb-6">
            <div className="flex items-center gap-2">
              <Gauge className="size-5 text-accent" strokeWidth={1.75} />
              <div>
                <div className="text-sm font-semibold tracking-tight">{APP_NAME}</div>
                <div className="text-[10px] tracking-[0.16em] text-muted uppercase">{APP_TAGLINE}</div>
              </div>
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5" aria-label="Primary">
            {NAV.map((item) => {
              const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
              const Icon = item.icon;
              return (
                <a
                  key={item.to}
                  href={`#${item.to}`}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150",
                    active ? "bg-elevated text-fg" : "text-muted hover:bg-elevated hover:text-fg",
                  )}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                  {item.label}
                </a>
              );
            })}
          </nav>
          <div className="mt-auto space-y-1 px-2 pt-4 text-[11px] text-muted">
            <div className="font-medium text-fg/80">{sessionLabel(session)}</div>
            <div>ET {lastUpdatedEt(analysis?.analyzedAt ?? Date.now())}</div>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col pb-16 lg:pb-0">
          {!ready ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted">Loading workspace…</div>
          ) : (
            <main id="main" className="flex-1">
              {page}
            </main>
          )}
        </div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-border bg-panel/95 px-1 py-1 backdrop-blur lg:hidden" aria-label="Mobile">
        {NAV.slice(0, 5).map((item) => {
          const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
          const Icon = item.icon;
          return (
            <a
              key={item.to}
              href={`#${item.to}`}
              className={cn(
                "flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-[10px]",
                active ? "text-fg" : "text-muted",
              )}
            >
              <Icon className="size-4" strokeWidth={1.75} />
              {item.label}
            </a>
          );
        })}
        <a href="#/settings" className={cn("flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-[10px]", path.startsWith("/settings") ? "text-fg" : "text-muted")}>
          <Settings className="size-4" strokeWidth={1.75} />
          More
        </a>
      </nav>
    </div>
  );
}
