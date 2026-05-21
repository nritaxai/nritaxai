import { trackEvent } from "./analytics";

const REPORTED_KEYS = new Set<string>();

const reportMetric = (name: string, value: number, metadata: Record<string, unknown> = {}) => {
  if (!Number.isFinite(value)) return;

  const path = typeof window === "undefined" ? "/" : window.location.pathname;
  const dedupeKey = `${name}:${path}`;
  if (REPORTED_KEYS.has(dedupeKey)) return;
  REPORTED_KEYS.add(dedupeKey);

  void trackEvent("frontend_performance_metric", {
    path,
    durationMs: Math.round(value),
    metadata: {
      metric: name,
      ...metadata,
    },
  });
};

export const startPerformanceMonitoring = () => {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") {
    return;
  }

  try {
    const paintObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        reportMetric(entry.name, entry.startTime, {
          entryType: entry.entryType,
        });
      }
    });
    paintObserver.observe({ type: "paint", buffered: true });
  } catch {
  }

  try {
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (!lastEntry) return;
      reportMetric("largest-contentful-paint", lastEntry.startTime, {
        entryType: lastEntry.entryType,
      });
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
  }

  try {
    let cumulativeLayoutShift = 0;
    const layoutObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries() as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>) {
        if (entry.hadRecentInput) continue;
        cumulativeLayoutShift += Number(entry.value || 0);
      }
      reportMetric("cumulative-layout-shift", cumulativeLayoutShift * 1000, {
        score: Number(cumulativeLayoutShift.toFixed(4)),
      });
    });
    layoutObserver.observe({ type: "layout-shift", buffered: true });
  } catch {
  }

  try {
    const longTaskObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (entry.duration < 120) continue;
        void trackEvent("frontend_long_task", {
          path: window.location.pathname,
          durationMs: Math.round(entry.duration),
          metadata: {
            metric: "longtask",
            startTime: Math.round(entry.startTime),
          },
        });
      }
    });
    longTaskObserver.observe({ type: "longtask", buffered: true });
  } catch {
  }
};

export const trackRouteRender = (path: string) => {
  if (typeof window === "undefined") return () => {};

  const startedAt = performance.now();
  let cancelled = false;
  let raf1 = 0;
  let raf2 = 0;

  raf1 = window.requestAnimationFrame(() => {
    raf2 = window.requestAnimationFrame(() => {
      if (cancelled) return;
      void trackEvent("frontend_route_render", {
        path,
        durationMs: Math.round(performance.now() - startedAt),
        metadata: {
          metric: "route-render",
        },
      });
    });
  });

  return () => {
    cancelled = true;
    window.cancelAnimationFrame(raf1);
    window.cancelAnimationFrame(raf2);
  };
};
