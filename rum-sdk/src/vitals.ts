import { RUMEventPayload } from './types';

export class WebVitalsObserver {
  private emit: (data: Partial<RUMEventPayload>) => void;
  private clsScore = 0;

  constructor(emit: (data: Partial<RUMEventPayload>) => void) {
    this.emit = emit;
    this.observeLCP();
    this.observeCLS();
    this.observeINP();
    this.observeNavigation();
  }

  private observeLCP(): void {
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          this.emit({
            event_type: 'web_vitals',
            lcp: Math.round(lastEntry.startTime)
          });
        }
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {}
  }

  private observeCLS(): void {
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      const observer = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            this.clsScore += entry.value;
          }
        }
        this.emit({
          event_type: 'web_vitals',
          cls: parseFloat(this.clsScore.toFixed(3))
        });
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {}
  }

  private observeINP(): void {
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      const observer = new PerformanceObserver((entryList) => {
        let maxDuration = 0;
        for (const entry of entryList.getEntries()) {
          if (entry.duration > maxDuration) {
            maxDuration = entry.duration;
          }
        }
        if (maxDuration > 0) {
          this.emit({
            event_type: 'web_vitals',
            inp: Math.round(maxDuration)
          });
        }
      });
      // 'event' observation for INP
      observer.observe({ type: 'event', durationThreshold: 16, buffered: true } as any);
    } catch (e) {}
  }

  private observeNavigation(): void {
    if (typeof performance === 'undefined' || !performance.getEntriesByType) return;
    try {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navEntries && navEntries.length > 0) {
        const nav = navEntries[0];
        const ttfb = nav.responseStart - nav.requestStart;
        const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
        const fcp = fcpEntry ? fcpEntry.startTime : undefined;

        this.emit({
          event_type: 'web_vitals',
          ttfb: ttfb > 0 ? Math.round(ttfb) : undefined,
          fcp: fcp ? Math.round(fcp) : undefined,
          duration: Math.round(nav.duration)
        });
      }
    } catch (e) {}
  }
}
