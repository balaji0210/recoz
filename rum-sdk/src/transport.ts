import { RUMEventPayload, RicozRumConfig } from './types';

export class Transport {
  private config: RicozRumConfig;
  private queue: RUMEventPayload[] = [];
  private timer: any = null;
  private isKilled = false;

  constructor(config: RicozRumConfig) {
    this.config = config;
    this.startPeriodicFlush();
    this.attachLifecycleListeners();
  }

  public setKilled(killed: boolean): void {
    this.isKilled = killed;
    if (killed) {
      this.queue = [];
      if (this.timer) clearInterval(this.timer);
    }
  }

  public enqueue(event: RUMEventPayload): void {
    if (this.isKilled) return;

    // Apply sampling
    if (this.config.sampleRate !== undefined && this.config.sampleRate < 1.0) {
      if (Math.random() > this.config.sampleRate && event.event_type !== 'error') {
        return; // Always preserve errors
      }
    }

    this.queue.push(event);

    const maxSize = this.config.maxBatchSize || 20;
    if (this.queue.length >= maxSize) {
      this.flush();
    }
  }

  public flush(): void {
    if (this.queue.length === 0 || this.isKilled) return;

    const eventsToSend = [...this.queue];
    this.queue = [];
    const endpoint = this.config.endpoint || 'http://localhost:8000/api/v1/ingest/rum';

    const payload = JSON.stringify({ events: eventsToSend });

    // Prefer fetch or sendBeacon
    if (typeof fetch !== 'undefined') {
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Ricoz-Key': this.config.appKey
        },
        body: payload,
        keepalive: true
      }).catch(() => {
        // Silently catch to never disrupt client application
      });
    } else if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(`${endpoint}?app_key=${encodeURIComponent(this.config.appKey)}`, blob);
    }
  }

  private startPeriodicFlush(): void {
    const interval = this.config.flushIntervalMs || 5000;
    this.timer = setInterval(() => {
      this.flush();
    }, interval);
  }

  private attachLifecycleListeners(): void {
    if (typeof window === 'undefined') return;

    const onPageHide = () => {
      this.flush();
    };

    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });
  }
}
