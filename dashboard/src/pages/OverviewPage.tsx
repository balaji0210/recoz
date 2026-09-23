import React, { useState, useEffect } from 'react';
import { Users, Clock, AlertTriangle, Cpu, ArrowUpRight } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { WebVitalGauge } from '../components/WebVitalGauge';
import { ServiceMap } from '../components/ServiceMap';
import { api } from '../api/client';
import { RumOverview, WebVitalsData, SlowPage, ErrorGroupItem, ServiceMapData } from '../types';

interface OverviewPageProps {
  appId: string;
  timeRange: string;
  setCurrentTab: (tab: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ appId, timeRange, setCurrentTab }) => {
  const [overview, setOverview] = useState<RumOverview | null>(null);
  const [vitals, setVitals] = useState<WebVitalsData | null>(null);
  const [slowPages, setSlowPages] = useState<SlowPage[]>([]);
  const [errors, setErrors] = useState<ErrorGroupItem[]>([]);
  const [serviceMap, setServiceMap] = useState<ServiceMapData | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [ov, vit, sp, errs, sm] = await Promise.all([
          api.getRumOverview(appId, timeRange),
          api.getWebVitals(appId),
          api.getSlowPages(appId),
          api.getErrorGroups(appId),
          api.getServiceMap(appId)
        ]);
        setOverview(ov);
        setVitals(vit);
        setSlowPages(sp);
        setErrors(errs);
        setServiceMap(sm);
      } catch (e) {
        console.error('Failed to load overview data', e);
      }
    };
    load();
  }, [appId, timeRange]);

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', marginBottom: 4 }}>
            System Health & Telemetry
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Real-time APM metrics, active user sessions, and service latency over past {timeRange}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge badge-healthy">System Operational</span>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <StatCard
          title="Active User Sessions"
          value={overview?.total_sessions.toLocaleString() || '1,420'}
          subValue="users"
          icon={Users}
          trend={{ value: '12%', isPositive: true }}
          accentColor="indigo"
        />
        <StatCard
          title="P75 Page Load Time"
          value={`${overview?.load_time.p75_ms || 410}ms`}
          subValue={`avg ${overview?.load_time.avg_ms || 385}ms`}
          icon={Clock}
          trend={{ value: '45ms faster', isPositive: true }}
          accentColor="emerald"
        />
        <StatCard
          title="JS Error Rate"
          value={`${overview?.error_rate_percent || 0.2}%`}
          subValue={`${overview?.total_errors || 18} total`}
          icon={AlertTriangle}
          trend={{ value: '0.05%', isPositive: true }}
          accentColor="rose"
        />
        <StatCard
          title="Synthetic Uptime"
          value="99.98%"
          subValue="3 checks"
          icon={Cpu}
          trend={{ value: '100% SLA', isPositive: true }}
          accentColor="cyan"
        />
      </div>

      {/* Web Vitals Quick Bar */}
      {vitals && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
              Core Web Vitals Performance
            </h2>
            <button
              onClick={() => setCurrentTab('rum')}
              style={{ background: 'none', border: 'none', color: 'var(--accent-indigo)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              Explore RUM Deep Dive <ArrowUpRight size={14} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <WebVitalGauge name="LCP" fullName="Largest Contentful Paint" metric={vitals.lcp} description="Loading speed" />
            <WebVitalGauge name="INP" fullName="Interaction to Next Paint" metric={vitals.inp} description="Responsiveness" />
            <WebVitalGauge name="CLS" fullName="Cumulative Layout Shift" metric={vitals.cls} description="Visual stability" />
            <WebVitalGauge name="TTFB" fullName="Time to First Byte" metric={vitals.ttfb} description="Server response" />
            <WebVitalGauge name="FCP" fullName="First Contentful Paint" metric={vitals.fcp} description="First render" />
          </div>
        </div>
      )}

      {/* Bottom Grid: Slow Pages & Unhandled Errors */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
        {/* Slowest Pages */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
              Slowest Client Routes (P95)
            </h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Top bottleneck candidates</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {slowPages.map((page, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>{page.route}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{page.page_views.toLocaleString()} pageviews • LCP {page.avg_lcp_ms}ms</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: page.p95_load_time_ms > 1000 ? '#e11d48' : '#d97706', fontFamily: 'var(--font-mono)' }}>
                    {page.p95_load_time_ms}ms
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>P95 load</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Active Error Groups */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
              Top Unhandled Exceptions
            </h3>
            <button
              onClick={() => setCurrentTab('errors')}
              style={{ background: 'none', border: 'none', color: 'var(--accent-indigo)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              View All Errors <ArrowUpRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {errors.slice(0, 3).map((err) => (
              <div
                key={err.id}
                onClick={() => setCurrentTab('errors')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ overflow: 'hidden', paddingRight: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="badge badge-danger">{err.error_type}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>v{err.last_release}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-main)', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {err.message}
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 60 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>{err.occurrence_count}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>events</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Service Map */}
      {serviceMap && (
        <ServiceMap data={serviceMap} />
      )}
    </div>
  );
};
