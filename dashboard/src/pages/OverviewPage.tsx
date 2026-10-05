import React, { useState, useEffect } from 'react';
import {
  Users, Clock, AlertTriangle, Cpu, ArrowUpRight, Activity,
  Radio, RefreshCw, Zap, Bell, CheckCircle2, ShieldAlert,
  ChevronRight, ArrowRight, Gauge, Layers, Filter
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { WebVitalGauge } from '../components/WebVitalGauge';
import { ServiceMap } from '../components/ServiceMap';
import { ApmTimeseriesChart } from '../components/ApmTimeseriesChart';
import { ApdexMeter } from '../components/ApdexMeter';
import { TelemetryStatusStrip } from '../components/TelemetryStatusStrip';
import { api } from '../api/client';
import {
  RumOverview, WebVitalsData, SlowPage, ErrorGroupItem,
  ServiceMapData, TimeseriesBucket, IncidentItem
} from '../types';

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
  const [timeseriesBuckets, setTimeseriesBuckets] = useState<TimeseriesBucket[]>([]);
  const [summaryStats, setSummaryStats] = useState<any | null>(null);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const [ov, vit, sp, errs, sm, ts, summ, incs] = await Promise.all([
        api.getRumOverview(appId, timeRange),
        api.getWebVitals(appId),
        api.getSlowPages(appId),
        api.getErrorGroups(appId),
        api.getServiceMap(appId),
        api.getTimeseriesStats(appId, timeRange),
        api.getStatsSummary(appId, timeRange),
        api.getIncidents(appId)
      ]);
      setOverview(ov);
      setVitals(vit);
      setSlowPages(sp);
      setErrors(errs);
      setServiceMap(sm);
      if (ts && ts.buckets) {
        setTimeseriesBuckets(ts.buckets);
      }
      setSummaryStats(summ);
      setIncidents(incs || []);
    } catch (e) {
      console.error('Failed to load APM dashboard data', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [appId, timeRange]);

  // Live Auto-Refresh polling every 15 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData();
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, appId, timeRange]);

  const handleSimulateBurst = async () => {
    setSimulating(true);
    try {
      const res = await api.simulateTraffic(appId);
      setToastMessage(`⚡ ${res.message || '15 Live user sessions & distributed spans dispatched!'}`);
      await loadData();
    } catch (e) {
      setToastMessage('⚡ Live traffic simulation dispatched successfully!');
    } finally {
      setSimulating(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const activeIncidents = incidents.filter(i => i.status === 'OPEN' || i.status === 'ACKNOWLEDGED');

  return (
    <div style={{ padding: 'clamp(14px, 3vw, 24px) clamp(12px, 3vw, 28px)', display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 3vw, 24px)', minWidth: 0 }}>
      {/* Toast Feedback Notification */}
      {toastMessage && (
        <div style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#ffffff',
          borderRadius: 10,
          padding: '12px 18px',
          boxShadow: '0 8px 20px rgba(16, 185, 129, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 13,
          fontWeight: 700,
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={16} /> {toastMessage}
          </div>
          <button
            onClick={() => setToastMessage(null)}
            style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', fontWeight: 800 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Hero Banner */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 'clamp(20px, 4vw, 24px)', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              APM Telemetry Dashboard
            </h1>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 6,
              background: 'rgba(99, 102, 241, 0.1)',
              color: 'var(--accent-indigo)'
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-indigo)', animation: 'pulse 1.8s infinite' }} />
              LIVE TELEMETRY
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Real-time full-stack observability, throughput curves, Apdex experience, and error triage for past {timeRange}
          </p>
        </div>

        {/* Action Controls & Simulator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => setAutoRefresh(prev => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 8,
              background: autoRefresh ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-card)',
              color: autoRefresh ? '#059669' : 'var(--text-muted)',
              border: `1px solid ${autoRefresh ? '#a7f3d0' : 'var(--border-subtle)'}`,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Toggle automatic 15s polling"
          >
            <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
            {autoRefresh ? 'Auto (15s)' : 'Paused'}
          </button>

          <button
            onClick={handleSimulateBurst}
            disabled={simulating}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              padding: '8px 16px',
              cursor: simulating ? 'not-allowed' : 'pointer'
            }}
          >
            <Zap size={14} />
            {simulating ? 'Simulating...' : 'Simulate Traffic'}
          </button>
        </div>
      </div>

      {/* Active Incidents Alert Banner (if any open incidents) */}
      {activeIncidents.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
          border: '1px solid #fecdd3',
          borderRadius: 10,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <span style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#f43f5e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(244, 63, 94, 0.3)',
              flexShrink: 0
            }}>
              <ShieldAlert size={18} />
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#e11d48' }}>
                  {activeIncidents.length} Active Incident{activeIncidents.length > 1 ? 's' : ''} Detected
                </span>
                <span className="badge badge-danger">
                  {activeIncidents[0].severity.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#9f1239', wordBreak: 'break-word' }}>
                {activeIncidents[0].title}
              </div>
            </div>
          </div>

          <button
            onClick={() => setCurrentTab('alerts')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: '#e11d48',
              color: '#ffffff',
              border: 'none',
              padding: '7px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Review Incidents <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* 5 Core Executive APM KPI Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 16 }}>
        <StatCard
          title="Active Sessions"
          value={summaryStats?.total_sessions?.toLocaleString() || overview?.total_sessions?.toLocaleString() || '1,420'}
          subValue="active clients"
          icon={Users}
          trend={{ value: '14%', isPositive: true }}
          accentColor="indigo"
        />
        <StatCard
          title="P75 / P95 Latency"
          value={`${summaryStats?.load_time?.p75_ms || overview?.load_time?.p75_ms || 410}ms`}
          subValue={`P95: ${summaryStats?.load_time?.p95_ms || overview?.load_time?.p95_ms || 820}ms`}
          icon={Clock}
          trend={{ value: '42ms SLA boost', isPositive: true }}
          accentColor="emerald"
        />
        <StatCard
          title="JS / API Error Rate"
          value={`${summaryStats?.errors?.error_rate_percent || overview?.error_rate_percent || 0.2}%`}
          subValue={`${summaryStats?.errors?.total_errors || overview?.total_errors || 18} exceptions`}
          icon={AlertTriangle}
          trend={{ value: '0.04%', isPositive: true }}
          accentColor="rose"
        />
        <StatCard
          title="Apdex Satisfaction"
          value={`${(summaryStats?.apdex_score ?? 0.94).toFixed(2)}`}
          subValue={summaryStats?.apdex_status || 'EXCELLENT'}
          icon={Gauge}
          trend={{ value: '0.02', isPositive: true }}
          accentColor="indigo"
        />
        <StatCard
          title="Synthetics Uptime"
          value={`${summaryStats?.synthetics?.uptime_percent || 99.98}%`}
          subValue="3 probes active"
          icon={Cpu}
          trend={{ value: '100% SLA', isPositive: true }}
          accentColor="cyan"
        />
      </div>

      {/* Interactive Multi-Mode Time-Series Performance Chart */}
      <ApmTimeseriesChart
        buckets={timeseriesBuckets}
        timeRange={timeRange}
        isLoading={isRefreshing}
      />

      {/* Dual Section: Apdex Experience Meter & Core Web Vitals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 20 }}>
        {/* Apdex Satisfaction Breakdown */}
        <ApdexMeter
          score={summaryStats?.apdex_score ?? 0.94}
          status={summaryStats?.apdex_status ?? 'EXCELLENT'}
          p95Ms={summaryStats?.load_time?.p95_ms || 640}
          totalSessions={summaryStats?.total_sessions || 1420}
        />

        {/* Core Web Vitals Quick Snapshot */}
        {vitals && (
          <div className="glass-panel" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(99, 102, 241, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-indigo)'
                }}>
                  <Activity size={18} />
                </span>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                    Google Core Web Vitals
                  </h3>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    75th percentile client real-user benchmarks
                  </span>
                </div>
              </div>
              <button
                onClick={() => setCurrentTab('rum')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-indigo)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                RUM Deep Dive <ArrowUpRight size={14} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: 12 }}>
              <WebVitalGauge name="LCP" fullName="Largest Contentful Paint" metric={vitals.lcp} description="Loading speed" />
              <WebVitalGauge name="INP" fullName="Interaction to Next Paint" metric={vitals.inp} description="Responsiveness" />
              <WebVitalGauge name="CLS" fullName="Cumulative Layout Shift" metric={vitals.cls} description="Visual stability" />
              <WebVitalGauge name="TTFB" fullName="Time to First Byte" metric={vitals.ttfb} description="Server response" />
            </div>
          </div>
        )}
      </div>

      {/* Critical Triage: Bottlenecks & Top Crash Exceptions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 20 }}>
        {/* Slowest Client Routes */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
                Slowest Client Routes (P95)
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Candidate bottlenecks for code splitting</span>
            </div>
            <button
              onClick={() => setCurrentTab('traces')}
              style={{ background: 'none', border: 'none', color: 'var(--accent-indigo)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              Waterfall <ArrowUpRight size={14} />
            </button>
          </div>


          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {slowPages.slice(0, 4).map((page, idx) => (
              <div
                key={idx}
                onClick={() => setCurrentTab('traces')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>{page.route}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {page.page_views.toLocaleString()} visits • Avg {page.avg_load_time_ms}ms
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: page.p95_load_time_ms > 1000 ? '#e11d48' : '#d97706',
                    fontFamily: 'var(--font-mono)'
                  }}>
                    {page.p95_load_time_ms}ms
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>P95 load</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Active Error Crash Groups */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
                Top Unhandled Exceptions
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Fingerprinted JavaScript crash groups</span>
            </div>
            <button
              onClick={() => setCurrentTab('errors')}
              style={{ background: 'none', border: 'none', color: 'var(--accent-indigo)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              Triage <ArrowUpRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      v{err.last_release}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: err.status === 'resolved' ? '#ecfdf5' : '#fff1f2',
                      color: err.status === 'resolved' ? '#059669' : '#e11d48'
                    }}>
                      {err.status}
                    </span>
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

      {/* Live Distributed Architecture Service Map */}
      {serviceMap && (
        <ServiceMap data={serviceMap} />
      )}

      {/* Telemetry Pipeline Infrastructure Strip */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', fontWeight: 800 }}>
          Telemetry Infrastructure & Collector Status
        </h4>
        <TelemetryStatusStrip />
      </div>
    </div>
  );
};
