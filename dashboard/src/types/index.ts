export interface Application {
  id: string;
  team_id: string;
  name: string;
  slug: string;
  tier: string;
  environment: string;
  ingest_key_prefix: string;
  allowed_origins: string[];
  created_at: string;
}

export interface RumOverview {
  time_range: string;
  total_sessions: number;
  avg_session_duration_sec: number;
  total_page_views: number;
  total_errors: number;
  failed_requests: number;
  error_rate_percent: number;
  load_time: {
    avg_ms: number;
    p50_ms: number;
    p75_ms: number;
    p95_ms: number;
  };
}

export interface WebVitalMetric {
  value: number | null;
  unit: string;
  rating: 'GOOD' | 'NEEDS_IMPROVEMENT' | 'POOR' | 'NO_DATA';
  good_threshold: number;
}

export interface WebVitalsData {
  lcp: WebVitalMetric;
  inp: WebVitalMetric;
  cls: WebVitalMetric;
  ttfb: WebVitalMetric;
  fcp: WebVitalMetric;
}

export interface SlowPage {
  route: string;
  page_views: number;
  avg_load_time_ms: number;
  p75_load_time_ms: number;
  p95_load_time_ms: number;
  avg_lcp_ms: number;
  avg_cls: number;
}

export interface ErrorGroupItem {
  id: string;
  fingerprint: string;
  error_type: string;
  message: string;
  status: 'unhandled' | 'resolved' | 'ignored';
  first_seen: string;
  last_seen: string;
  occurrence_count: number;
  affected_users_count: number;
  last_release: string;
}

export interface SpanNode {
  id: string;
  span_id: string;
  parent_span_id: string | null;
  service_name: string;
  name: string;
  kind: string;
  duration_ms: number;
  offset_ms: number;
  offset_percent: number;
  duration_percent: number;
  status_code: 'OK' | 'ERROR' | 'UNSET';
  status_message?: string;
  attributes: Record<string, any>;
  children: SpanNode[];
}

export interface TraceWaterfallData {
  root_spans: SpanNode[];
  total_duration_ms: number;
  span_count: number;
  services_count: number;
  root_cause_hint?: {
    type: 'ERROR' | 'BOTTLENECK';
    span_id: string;
    service_name: string;
    operation: string;
    message: string;
  };
}

export interface ServiceMapNode {
  id: string;
  name: string;
  type: string;
  request_count: number;
  avg_latency_ms: number;
  error_rate_percent: number;
  status: 'healthy' | 'danger';
}

export interface ServiceMapEdge {
  source: string;
  target: string;
  call_count: number;
  avg_latency_ms: number;
  error_rate_percent: number;
}

export interface ServiceMapData {
  nodes: ServiceMapNode[];
  edges: ServiceMapEdge[];
}

export interface SyntheticCheckItem {
  id: string;
  application_id: string;
  name: string;
  check_type: string;
  url: string;
  method: string;
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  uptime_percent: number;
  latency_sla_ms: number;
  interval_seconds: number;
  last_run_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AlertRuleItem {
  id: string;
  application_id: string;
  team_id: string;
  name: string;
  metric_type: string;
  operator: string;
  threshold: number;
  duration_seconds: number;
  severity: 'info' | 'warning' | 'critical';
  state: 'OK' | 'PENDING' | 'FIRING' | 'RESOLVED';
  is_active: boolean;
  created_at: string;
}

export interface IncidentItem {
  id: string;
  alert_rule_id: string;
  application_id: string;
  title: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  current_value: number;
  threshold: number;
  triggered_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
}
