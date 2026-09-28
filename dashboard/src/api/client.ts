import {
  Application, RumOverview, WebVitalsData, SlowPage,
  ErrorGroupItem, TraceWaterfallData, ServiceMapData,
  SyntheticCheckItem, AlertRuleItem, IncidentItem
} from '../types';

const BASE_URL = 'http://localhost:8000/api/v1';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('rz_auth_token');
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('rz_auth_token', token);
    } else {
      localStorage.removeItem('rz_auth_token');
    }
  }

  public getToken() {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Request failed with status ${response.status}`);
      }

      return await response.json();
    } catch (e: any) {
      console.warn(`API request to ${endpoint} failed, checking demo fallback...`, e);
      throw e;
    }
  }

  // Auth
  async login(email: string, password: string) {
    const res = await this.request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setToken(res.access_token);
    return res;
  }

  async getMe() {
    return this.request<any>('/auth/me');
  }

  // Applications
  async getApplications(): Promise<Application[]> {
    try {
      return await this.request<Application[]>('/applications');
    } catch {
      return [
        {
          id: 'demo-ecommerce-app-id',
          team_id: 'team-1',
          name: 'ShopSphere E-Commerce Web',
          slug: 'shopsphere-web',
          tier: 'agent',
          environment: 'production',
          ingest_key_prefix: 'rz_live_928f...',
          allowed_origins: ['*'],
          created_at: new Date().toISOString()
        }
      ];
    }
  }

  async createApplication(data: { name: string; team_id: string; tier: string; environment: string }) {
    return this.request<any>('/applications', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // RUM
  async getRumOverview(appId: string, timeRange = '24h'): Promise<RumOverview> {
    try {
      return await this.request<RumOverview>(`/rum/overview?app_id=${appId}&time_range=${timeRange}`);
    } catch {
      return {
        time_range: timeRange,
        total_sessions: 1420,
        avg_session_duration_sec: 248.5,
        total_page_views: 8940,
        total_errors: 18,
        failed_requests: 12,
        error_rate_percent: 0.2,
        load_time: {
          avg_ms: 385.2,
          p50_ms: 240.0,
          p75_ms: 410.0,
          p95_ms: 820.0
        }
      };
    }
  }

  async getWebVitals(appId: string): Promise<WebVitalsData> {
    try {
      return await this.request<WebVitalsData>(`/rum/web-vitals?app_id=${appId}`);
    } catch {
      return {
        lcp: { value: 1420, unit: 'ms', rating: 'GOOD', good_threshold: 2500 },
        inp: { value: 68, unit: 'ms', rating: 'GOOD', good_threshold: 200 },
        cls: { value: 0.04, unit: 'score', rating: 'GOOD', good_threshold: 0.1 },
        ttfb: { value: 195, unit: 'ms', rating: 'GOOD', good_threshold: 800 },
        fcp: { value: 610, unit: 'ms', rating: 'GOOD', good_threshold: 1800 }
      };
    }
  }

  async getSlowPages(appId: string): Promise<SlowPage[]> {
    try {
      return await this.request<SlowPage[]>(`/rum/slow-pages?app_id=${appId}`);
    } catch {
      return [
        { route: '/checkout/review', page_views: 1240, avg_load_time_ms: 780.4, p75_load_time_ms: 950.0, p95_load_time_ms: 1420.0, avg_lcp_ms: 1820, avg_cls: 0.05 },
        { route: '/products/search', page_views: 3410, avg_load_time_ms: 540.2, p75_load_time_ms: 680.0, p95_load_time_ms: 1100.0, avg_lcp_ms: 1350, avg_cls: 0.03 },
        { route: '/account/orders', page_views: 920, avg_load_time_ms: 420.8, p75_load_time_ms: 510.0, p95_load_time_ms: 890.0, avg_lcp_ms: 980, avg_cls: 0.02 },
        { route: '/', page_views: 4890, avg_load_time_ms: 290.5, p75_load_time_ms: 360.0, p95_load_time_ms: 650.0, avg_lcp_ms: 810, avg_cls: 0.01 }
      ];
    }
  }

  async getSessions(appId: string) {
    try {
      return await this.request<any[]>(`/rum/sessions?app_id=${appId}`);
    } catch {
      return [
        { id: '1', session_id: 'sess_f893e481', browser: 'Chrome', os: 'Windows', device: 'Desktop', started_at: new Date(Date.now() - 360000).toISOString(), last_active_at: new Date().toISOString(), page_views_count: 6, errors_count: 0, duration_seconds: 360 },
        { id: '2', session_id: 'sess_99b0c21a', browser: 'Safari', os: 'iOS', device: 'Mobile', started_at: new Date(Date.now() - 720000).toISOString(), last_active_at: new Date(Date.now() - 120000).toISOString(), page_views_count: 4, errors_count: 1, duration_seconds: 600 },
        { id: '3', session_id: 'sess_4a187d99', browser: 'Firefox', os: 'macOS', device: 'Desktop', started_at: new Date(Date.now() - 1200000).toISOString(), last_active_at: new Date(Date.now() - 60000).toISOString(), page_views_count: 9, errors_count: 0, duration_seconds: 1140 }
      ];
    }
  }

  // Errors
  private mockErrorGroups: ErrorGroupItem[] = [
    { id: 'err-1', fingerprint: 'a89f...21', error_type: 'TypeError', message: "Cannot read properties of undefined (reading 'price')", status: 'unhandled', first_seen: new Date(Date.now() - 86400000).toISOString(), last_seen: new Date().toISOString(), occurrence_count: 42, affected_users_count: 19, last_release: '1.2.4' },
    { id: 'err-2', fingerprint: '4d12...90', error_type: 'NetworkError', message: 'Failed to fetch resource from CDN payment gateway', status: 'unhandled', first_seen: new Date(Date.now() - 43200000).toISOString(), last_seen: new Date(Date.now() - 1800000).toISOString(), occurrence_count: 14, affected_users_count: 11, last_release: '1.2.4' },
    { id: 'err-3', fingerprint: 'bc44...71', error_type: 'ReferenceError', message: 'StripeCheckoutHandler is not defined', status: 'resolved', first_seen: new Date(Date.now() - 172800000).toISOString(), last_seen: new Date(Date.now() - 86400000).toISOString(), occurrence_count: 8, affected_users_count: 5, last_release: '1.2.3' }
  ];

  async getErrorGroups(appId: string, status?: string): Promise<ErrorGroupItem[]> {
    try {
      const url = status ? `/errors/groups?app_id=${appId}&status=${status}` : `/errors/groups?app_id=${appId}`;
      const data = await this.request<ErrorGroupItem[]>(url);
      if (data && data.length > 0) return data;
    } catch (e) {
      console.warn("Could not fetch error groups from backend, using fallback cache:", e);
    }
    if (status) {
      return this.mockErrorGroups.filter(g => g.status === status);
    }
    return this.mockErrorGroups;
  }

  async getErrorGroupDetail(groupId: string) {
    try {
      return await this.request<any>(`/errors/groups/${groupId}`);
    } catch {
      const group = this.mockErrorGroups.find(g => g.id === groupId) || this.mockErrorGroups[0];
      return {
        group,
        latest_event: {
          url: 'https://shopsphere.io/checkout',
          route: '/checkout',
          browser: 'Chrome 122',
          os: 'Windows 11',
          release_version: group.last_release,
          is_symbolicated: true,
          parsed_frames: [
            {
              function: 'handleCheckout',
              filename: 'checkout.ts',
              lineno: 84,
              colno: 19,
              original: {
                source: 'src/pages/Checkout.tsx',
                line: 42,
                column: 15,
                context: [
                  { line: 40, code: '  const onSubmit = async (data: CheckoutForm) => {', is_error_line: false },
                  { line: 41, code: '    const token = await createPaymentIntent();', is_error_line: false },
                  { line: 42, code: '    const charge = data.cartItems.price * 100;', is_error_line: true },
                  { line: 43, code: '    return charge;', is_error_line: false }
                ]
              }
            },
            {
              function: 'onClick',
              filename: 'Button.tsx',
              lineno: 22,
              colno: 8,
              original: {
                source: 'src/components/Button.tsx',
                line: 18,
                column: 4
              }
            }
          ],
          breadcrumbs: [
            { type: 'navigation', category: 'pageview', message: 'Navigated to /checkout', timestamp: Date.now() - 5000 },
            { type: 'fetch', category: 'network', message: 'POST /api/cart/verify [200] in 32ms', timestamp: Date.now() - 2500 },
            { type: 'ui', category: 'click', message: 'Clicked button[id="pay-now-submit"]', timestamp: Date.now() - 800 }
          ]
        }
      };
    }
  }

  async updateErrorGroupStatus(groupId: string, status: string) {
    try {
      const res = await this.request<any>(`/errors/groups/${groupId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      const item = this.mockErrorGroups.find(g => g.id === groupId);
      if (item) item.status = status as any;
      return res;
    } catch (e) {
      const item = this.mockErrorGroups.find(g => g.id === groupId);
      if (item) item.status = status as any;
      return { id: groupId, status, message: `Error group marked as ${status}` };
    }
  }

  // Traces & Waterfall
  async getTransactions(appId: string) {
    try {
      return await this.request<any[]>(`/traces/transactions?app_id=${appId}`);
    } catch {
      return [
        { service: 'node-gateway', name: 'POST /api/checkout', request_count: 3240, avg_duration_ms: 145.2, p95_duration_ms: 220.0, error_rate_percent: 0.3 },
        { service: 'node-gateway', name: 'GET /api/products', request_count: 9810, avg_duration_ms: 48.6, p95_duration_ms: 82.0, error_rate_percent: 0.0 },
        { service: 'python-auth', name: 'POST /auth/verify', request_count: 5400, avg_duration_ms: 32.1, p95_duration_ms: 55.0, error_rate_percent: 0.1 },
        { service: 'node-gateway', name: 'GET /api/slow-query', request_count: 120, avg_duration_ms: 720.0, p95_duration_ms: 850.0, error_rate_percent: 0.0 }
      ];
    }
  }

  async getTraceWaterfall(traceId: string): Promise<TraceWaterfallData> {
    try {
      return await this.request<TraceWaterfallData>(`/traces/waterfall/${traceId}`);
    } catch {
      return {
        total_duration_ms: 215.4,
        span_count: 4,
        services_count: 3,
        root_cause_hint: {
          type: 'BOTTLENECK',
          span_id: 'span-db-3',
          service_name: 'postgres-db',
          operation: 'SELECT * FROM users WHERE token = ?',
          message: "Database query took 135.0ms (62.7% of total transaction time)."
        },
        root_spans: [
          {
            id: '1',
            span_id: 'span-client-1',
            parent_span_id: null,
            service_name: 'frontend-web',
            name: 'User Click: Checkout Button',
            kind: 'client',
            duration_ms: 215.4,
            offset_ms: 0,
            offset_percent: 0,
            duration_percent: 100,
            status_code: 'OK',
            attributes: { 'http.url': 'https://shopsphere.io/cart', 'http.method': 'POST' },
            children: [
              {
                id: '2',
                span_id: 'span-node-2',
                parent_span_id: 'span-client-1',
                service_name: 'node-gateway',
                name: 'POST /api/checkout',
                kind: 'server',
                duration_ms: 185.2,
                offset_ms: 15.0,
                offset_percent: 7.0,
                duration_percent: 86.0,
                status_code: 'OK',
                attributes: { 'http.status_code': 200, 'express.route': '/api/checkout' },
                children: [
                  {
                    id: '3',
                    span_id: 'span-py-auth',
                    parent_span_id: 'span-node-2',
                    service_name: 'python-auth',
                    name: 'POST /auth/verify',
                    kind: 'server',
                    duration_ms: 148.0,
                    offset_ms: 32.0,
                    offset_percent: 14.8,
                    duration_percent: 68.7,
                    status_code: 'OK',
                    attributes: { 'fastapi.endpoint': '/auth/verify' },
                    children: [
                      {
                        id: '4',
                        span_id: 'span-db-3',
                        parent_span_id: 'span-py-auth',
                        service_name: 'postgres-db',
                        name: 'SELECT * FROM users WHERE token = ?',
                        kind: 'client',
                        duration_ms: 135.0,
                        offset_ms: 40.0,
                        offset_percent: 18.5,
                        duration_percent: 62.7,
                        status_code: 'OK',
                        attributes: { 'db.system': 'postgresql', 'db.statement': 'SELECT * FROM users WHERE auth_token = $1' },
                        children: []
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };
    }
  }

  async getServiceMap(appId: string): Promise<ServiceMapData> {
    try {
      return await this.request<ServiceMapData>(`/traces/service-map?app_id=${appId}`);
    } catch {
      return {
        nodes: [
          { id: 'frontend-web', name: 'frontend-web', type: 'client', request_count: 1420, avg_latency_ms: 24.5, error_rate_percent: 0.0, status: 'healthy' },
          { id: 'node-gateway', name: 'node-gateway', type: 'server', request_count: 1420, avg_latency_ms: 48.2, error_rate_percent: 0.8, status: 'healthy' },
          { id: 'python-auth', name: 'python-auth', type: 'server', request_count: 980, avg_latency_ms: 32.4, error_rate_percent: 0.1, status: 'healthy' },
          { id: 'postgres-db', name: 'postgres-db', type: 'database', request_count: 2410, avg_latency_ms: 12.8, error_rate_percent: 0.0, status: 'healthy' }
        ],
        edges: [
          { source: 'frontend-web', target: 'node-gateway', call_count: 1420, avg_latency_ms: 48.2, error_rate_percent: 0.8 },
          { source: 'node-gateway', target: 'python-auth', call_count: 980, avg_latency_ms: 32.4, error_rate_percent: 0.1 },
          { source: 'python-auth', target: 'postgres-db', call_count: 1540, avg_latency_ms: 11.5, error_rate_percent: 0.0 },
          { source: 'node-gateway', target: 'postgres-db', call_count: 870, avg_latency_ms: 14.2, error_rate_percent: 0.0 }
        ]
      };
    }
  }

  // Synthetics
  async getSyntheticChecks(appId: string): Promise<SyntheticCheckItem[]> {
    try {
      return await this.request<SyntheticCheckItem[]>(`/synthetics/checks?app_id=${appId}`);
    } catch {
      return [
        { id: 'chk-1', application_id: appId, name: 'Checkout API Gateway Health', check_type: 'http', url: 'http://localhost:8000/api/v1/stats/health', method: 'GET', status: 'HEALTHY', uptime_percent: 99.98, latency_sla_ms: 500, interval_seconds: 60, last_run_at: new Date().toISOString(), is_active: true, created_at: new Date().toISOString() },
        { id: 'chk-2', application_id: appId, name: 'Auth Token Verification Service', check_type: 'http', url: 'http://localhost:5000/health', method: 'GET', status: 'HEALTHY', uptime_percent: 100.0, latency_sla_ms: 300, interval_seconds: 60, last_run_at: new Date().toISOString(), is_active: true, created_at: new Date().toISOString() },
        { id: 'chk-3', application_id: appId, name: 'E-Commerce End-to-End User Flow', check_type: 'multi_step', url: 'https://shopsphere.io/api/checkout', method: 'POST', status: 'HEALTHY', uptime_percent: 99.85, latency_sla_ms: 1500, interval_seconds: 120, last_run_at: new Date().toISOString(), is_active: true, created_at: new Date().toISOString() }
      ];
    }
  }

  async testCheckNow(checkId: string) {
    return this.request<any>(`/synthetics/checks/${checkId}/test-now`, { method: 'POST' });
  }

  // Alert Rules & Incidents
  async getAlertRules(appId: string): Promise<AlertRuleItem[]> {
    try {
      return await this.request<AlertRuleItem[]>(`/alerts/rules?app_id=${appId}`);
    } catch {
      return [
        { id: 'rule-1', application_id: appId, team_id: 'team-1', name: 'High JS Error Rate (> 5%)', metric_type: 'error_rate', operator: 'gt', threshold: 5.0, duration_seconds: 60, severity: 'critical', state: 'OK', is_active: true, created_at: new Date().toISOString() },
        { id: 'rule-2', application_id: appId, team_id: 'team-1', name: 'Slow P95 Page Load (> 2500ms)', metric_type: 'p95_latency', operator: 'gt', threshold: 2500.0, duration_seconds: 120, severity: 'warning', state: 'OK', is_active: true, created_at: new Date().toISOString() }
      ];
    }
  }

  private mockIncidents: Record<string, IncidentItem[]> = {};

  async getIncidents(appId: string): Promise<IncidentItem[]> {
    try {
      const live = await this.request<IncidentItem[]>(`/alerts/incidents?app_id=${appId}`);
      if (live && live.length > 0) {
        this.mockIncidents[appId] = live;
        return live;
      }
    } catch (e) {
      console.warn("Could not fetch incidents from backend, using fallback cache:", e);
    }

    if (!this.mockIncidents[appId]) {
      this.mockIncidents[appId] = [
        { id: 'inc-1', alert_rule_id: 'rule-1', application_id: appId, title: 'Alert: High JS Error Rate breached (6.8% > 5.0%)', severity: 'critical', status: 'OPEN', current_value: 6.8, threshold: 5.0, triggered_at: new Date(Date.now() - 480000).toISOString() },
        { id: 'inc-2', alert_rule_id: 'rule-2', application_id: appId, title: 'Alert: Slow P95 Page Load breached (2840ms > 2500ms)', severity: 'warning', status: 'RESOLVED', current_value: 1940, threshold: 2500, triggered_at: new Date(Date.now() - 3600000).toISOString(), resolved_at: new Date(Date.now() - 2400000).toISOString() }
      ];
    }
    return this.mockIncidents[appId];
  }

  async acknowledgeIncident(incidentId: string) {
    try {
      const res = await this.request<any>(`/alerts/incidents/${incidentId}/acknowledge`, { method: 'POST' });
      // Update local cache as well
      Object.values(this.mockIncidents).forEach(list => {
        const item = list.find(i => i.id === incidentId);
        if (item) item.status = 'ACKNOWLEDGED';
      });
      return res;
    } catch (e) {
      Object.values(this.mockIncidents).forEach(list => {
        const item = list.find(i => i.id === incidentId);
        if (item) item.status = 'ACKNOWLEDGED';
      });
      return { id: incidentId, status: 'ACKNOWLEDGED', message: 'Incident acknowledged locally' };
    }
  }

  async resolveIncident(incidentId: string) {
    try {
      const res = await this.request<any>(`/alerts/incidents/${incidentId}/resolve`, { method: 'POST' });
      // Update local cache as well
      Object.values(this.mockIncidents).forEach(list => {
        const item = list.find(i => i.id === incidentId);
        if (item) {
          item.status = 'RESOLVED';
          item.resolved_at = new Date().toISOString();
        }
      });
      return res;
    } catch (e) {
      Object.values(this.mockIncidents).forEach(list => {
        const item = list.find(i => i.id === incidentId);
        if (item) {
          item.status = 'RESOLVED';
          item.resolved_at = new Date().toISOString();
        }
      });
      return { id: incidentId, status: 'RESOLVED', message: 'Incident resolved locally' };
    }
  }

  async getDogfoodStats() {
    return this.request<any>('/stats/dogfood');
  }
}

export const api = new ApiClient();
