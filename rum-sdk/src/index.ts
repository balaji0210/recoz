import { RicozRumConfig, RUMEventPayload, Breadcrumb } from './types';
import { SessionManager } from './session';
import { WebVitalsObserver } from './vitals';
import { NavigationTracker } from './navigation';
import { NetworkInterceptor } from './network';
import { ErrorTracker } from './errors';
import { Transport } from './transport';
import { scrubUrl } from './scrubber';

export class RicozRum {
  private config: RicozRumConfig;
  private sessionManager: SessionManager;
  private transport: Transport;
  private breadcrumbs: Breadcrumb[] = [];
  private maxBreadcrumbs = 25;

  constructor(config: RicozRumConfig) {
    this.config = {
      endpoint: 'http://localhost:8000/api/v1/ingest/rum',
      enableWebVitals: true,
      enableTracing: true,
      enableErrors: true,
      enableNetwork: true,
      sampleRate: 1.0,
      releaseVersion: '1.0.0',
      ...config
    };

    this.sessionManager = new SessionManager();
    this.transport = new Transport(this.config);

    this.initModules();
  }

  private initModules(): void {
    const emit = (partial: Partial<RUMEventPayload>) => this.emitEvent(partial);
    const recordBreadcrumb = (b: Breadcrumb) => this.addBreadcrumb(b);
    const getBreadcrumbs = () => [...this.breadcrumbs];

    // 1. Navigation & Route Tracker
    new NavigationTracker(emit, recordBreadcrumb);

    // 2. Web Vitals
    if (this.config.enableWebVitals) {
      new WebVitalsObserver(emit);
    }

    // 3. Network & Distributed Tracing
    if (this.config.enableNetwork) {
      new NetworkInterceptor(
        emit,
        recordBreadcrumb,
        this.config.endpoint || '',
        this.config.enableTracing
      );
    }

    // 4. Error Diagnostics
    if (this.config.enableErrors) {
      new ErrorTracker(emit, getBreadcrumbs, recordBreadcrumb, this.config.releaseVersion);
    }
  }

  public emitEvent(partial: Partial<RUMEventPayload>): void {
    try {
      const clientInfo = SessionManager.getClientInfo();
      const event: RUMEventPayload = {
        session_id: this.sessionManager.getSessionId(),
        event_type: partial.event_type || 'page_view',
        url: partial.url || scrubUrl(window.location.href),
        route: partial.route || window.location.pathname,
        duration: partial.duration,
        status_code: partial.status_code,
        lcp: partial.lcp,
        inp: partial.inp,
        cls: partial.cls,
        ttfb: partial.ttfb,
        fcp: partial.fcp,
        fid: partial.fid,
        trace_id: partial.trace_id,
        span_id: partial.span_id,
        error_type: partial.error_type,
        message: partial.message,
        stack: partial.stack,
        release_version: partial.release_version || this.config.releaseVersion,
        browser: clientInfo.browser,
        os: clientInfo.os,
        device: clientInfo.device,
        user_agent: clientInfo.user_agent,
        breadcrumbs: partial.breadcrumbs,
        metadata: partial.metadata || {},
        timestamp: Date.now()
      };

      this.transport.enqueue(event);
    } catch (e) {
      // Defensive: never let monitoring failure impact host application
    }
  }

  public addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.breadcrumbs.push(breadcrumb);
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  public trackCustomEvent(name: string, data: Record<string, any> = {}): void {
    this.emitEvent({
      event_type: 'page_view',
      metadata: { custom_event: name, ...data }
    });
  }

  public kill(): void {
    this.transport.setKilled(true);
  }
}

let globalInstance: RicozRum | null = null;

export function initRicozRum(config: RicozRumConfig): RicozRum {
  if (!globalInstance) {
    globalInstance = new RicozRum(config);
    if (typeof window !== 'undefined') {
      (window as any).RicozRum = globalInstance;
    }
  }
  return globalInstance;
}

// Auto-initialize if loaded via <script data-app-key="...">
if (typeof document !== 'undefined') {
  const currentScript = document.currentScript as HTMLScriptElement;
  if (currentScript) {
    const appKey = currentScript.getAttribute('data-app-key');
    const endpoint = currentScript.getAttribute('data-endpoint') || undefined;
    const environment = currentScript.getAttribute('data-environment') || 'production';

    if (appKey) {
      initRicozRum({
        appKey,
        endpoint,
        environment
      });
    }
  }
}
