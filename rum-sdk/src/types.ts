export interface RicozRumConfig {
  appKey: string;
  endpoint?: string;
  environment?: string;
  releaseVersion?: string;
  sampleRate?: number; // 0.0 - 1.0 (default 1.0)
  enableWebVitals?: boolean;
  enableTracing?: boolean;
  enableErrors?: boolean;
  enableNetwork?: boolean;
  allowedOrigins?: string[];
  maxBatchSize?: number;
  flushIntervalMs?: number;
}

export interface Breadcrumb {
  type: 'click' | 'navigation' | 'fetch' | 'log';
  category: string;
  message: string;
  timestamp: number;
  data?: Record<string, any>;
}

export interface RUMEventPayload {
  session_id: string;
  event_type: 'page_view' | 'web_vitals' | 'route_change' | 'fetch' | 'xhr' | 'error';
  url: string;
  route?: string;
  duration?: number;
  status_code?: number;
  lcp?: number;
  inp?: number;
  cls?: number;
  ttfb?: number;
  fcp?: number;
  fid?: number;
  trace_id?: string;
  span_id?: string;
  error_type?: string;
  message?: string;
  stack?: string;
  release_version?: string;
  browser?: string;
  os?: string;
  device?: string;
  user_agent?: string;
  breadcrumbs?: Breadcrumb[];
  metadata?: Record<string, any>;
  timestamp: number;
}
