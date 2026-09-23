import { RUMEventPayload, Breadcrumb } from './types';
import { scrubUrl } from './scrubber';

function generateHex(length: number): string {
  let result = '';
  const characters = '0123456789abcdef';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export class NetworkInterceptor {
  private emit: (data: Partial<RUMEventPayload>) => void;
  private recordBreadcrumb: (b: Breadcrumb) => void;
  private ingestEndpoint: string;
  private enableTracing: boolean;

  constructor(
    emit: (data: Partial<RUMEventPayload>) => void,
    recordBreadcrumb: (b: Breadcrumb) => void,
    ingestEndpoint: string,
    enableTracing: boolean = true
  ) {
    this.emit = emit;
    this.recordBreadcrumb = recordBreadcrumb;
    this.ingestEndpoint = ingestEndpoint;
    this.enableTracing = enableTracing;

    this.patchFetch();
    this.patchXHR();
  }

  private patchFetch(): void {
    if (typeof window.fetch === 'undefined') return;
    const originalFetch = window.fetch;
    const self = this;

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      const urlStr = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : (input as Request).url);
      
      // Do not intercept SDK's own ingest calls to avoid loops
      if (urlStr.includes(self.ingestEndpoint) || urlStr.includes('/api/v1/ingest/')) {
        return originalFetch.apply(this, [input, init]);
      }

      const method = init?.method || (typeof input === 'object' && 'method' in input ? input.method : 'GET');
      const startTime = performance.now();
      
      // Distributed Trace ID & Span ID generation
      const traceId = generateHex(32);
      const spanId = generateHex(16);
      const traceparent = `00-${traceId}-${spanId}-01`;

      let reqInit: RequestInit = init ? { ...init } : {};
      if (self.enableTracing) {
        const headers = new Headers(reqInit.headers || (typeof input === 'object' && 'headers' in input ? input.headers : {}));
        if (!headers.has('traceparent')) {
          headers.set('traceparent', traceparent);
        }
        reqInit.headers = headers;
      }

      try {
        const response = await originalFetch.apply(this, [input, reqInit]);
        const duration = Math.round(performance.now() - startTime);
        const cleanUrl = scrubUrl(urlStr);

        self.emit({
          event_type: 'fetch',
          url: cleanUrl,
          duration,
          status_code: response.status,
          trace_id: traceId,
          span_id: spanId,
          metadata: { method, status: response.status }
        });

        self.recordBreadcrumb({
          type: 'fetch',
          category: 'network',
          message: `${method} ${cleanUrl} [${response.status}] in ${duration}ms`,
          timestamp: Date.now(),
          data: { status: response.status, duration, trace_id: traceId }
        });

        return response;
      } catch (err: any) {
        const duration = Math.round(performance.now() - startTime);
        const cleanUrl = scrubUrl(urlStr);

        self.emit({
          event_type: 'fetch',
          url: cleanUrl,
          duration,
          status_code: 0,
          trace_id: traceId,
          span_id: spanId,
          metadata: { method, error: err.message }
        });

        self.recordBreadcrumb({
          type: 'fetch',
          category: 'network',
          message: `${method} ${cleanUrl} FAILED: ${err.message}`,
          timestamp: Date.now()
        });

        throw err;
      }
    };
  }

  private patchXHR(): void {
    if (typeof XMLHttpRequest === 'undefined') return;
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const self = this;

    XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
      (this as any)._rz_method = method;
      (this as any)._rz_url = url.toString();
      (this as any)._rz_start = performance.now();
      (this as any)._rz_trace_id = generateHex(32);
      (this as any)._rz_span_id = generateHex(16);
      return originalOpen.apply(this, [method, url, ...rest] as any);
    };

    XMLHttpRequest.prototype.send = function (...args: any[]) {
      const url = (this as any)._rz_url || '';
      if (!url.includes(self.ingestEndpoint) && !url.includes('/api/v1/ingest/') && self.enableTracing) {
        try {
          const traceparent = `00-${(this as any)._rz_trace_id}-${(this as any)._rz_span_id}-01`;
          this.setRequestHeader('traceparent', traceparent);
        } catch (e) {}
      }

      this.addEventListener('loadend', () => {
        if (url.includes(self.ingestEndpoint) || url.includes('/api/v1/ingest/')) return;
        const duration = Math.round(performance.now() - ((this as any)._rz_start || performance.now()));
        const cleanUrl = scrubUrl(url);
        const status = this.status;

        self.emit({
          event_type: 'xhr',
          url: cleanUrl,
          duration,
          status_code: status,
          trace_id: (this as any)._rz_trace_id,
          span_id: (this as any)._rz_span_id,
          metadata: { method: (this as any)._rz_method, status }
        });

        self.recordBreadcrumb({
          type: 'fetch',
          category: 'xhr',
          message: `${(this as any)._rz_method} ${cleanUrl} [${status}] in ${duration}ms`,
          timestamp: Date.now()
        });
      });

      return originalSend.apply(this, args as any);
    };
  }
}
