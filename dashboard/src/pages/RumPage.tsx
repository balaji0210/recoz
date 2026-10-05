import React, { useState, useEffect } from 'react';
import { Globe, Smartphone, Monitor, Clock, Shield, Search, ArrowRight, UserCheck } from 'lucide-react';
import { WebVitalGauge } from '../components/WebVitalGauge';
import { api } from '../api/client';
import { WebVitalsData, SlowPage } from '../types';

interface RumPageProps {
  appId: string;
  timeRange: string;
}

export const RumPage: React.FC<RumPageProps> = ({ appId, timeRange }) => {
  const [vitals, setVitals] = useState<WebVitalsData | null>(null);
  const [slowPages, setSlowPages] = useState<SlowPage[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [sessionTimeline, setSessionTimeline] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [vit, sp, sess] = await Promise.all([
          api.getWebVitals(appId),
          api.getSlowPages(appId),
          api.getSessions(appId)
        ]);
        setVitals(vit);
        setSlowPages(sp);
        setSessions(sess);
      } catch (e) {
        console.error('Failed to load RUM data', e);
      }
    };
    load();
  }, [appId, timeRange]);

  const handleSelectSession = async (sess: any) => {
    setSelectedSession(sess);
    setSessionTimeline([
      { id: '1', event_type: 'page_view', route: '/', url: 'https://shopsphere.io/', duration: 320, created_at: sess.started_at },
      { id: '2', event_type: 'fetch', route: '/', url: 'https://shopsphere.io/api/products', status_code: 200, duration: 48, created_at: sess.started_at },
      { id: '3', event_type: 'route_change', route: '/cart', url: 'https://shopsphere.io/cart', created_at: sess.last_active_at },
      { id: '4', event_type: 'fetch', route: '/cart', url: 'https://shopsphere.io/api/checkout', status_code: sess.errors_count > 0 ? 500 : 200, duration: 185, created_at: sess.last_active_at }
    ]);
  };

  return (
    <div style={{ padding: 'clamp(14px, 3vw, 24px) clamp(12px, 3vw, 28px)', display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 3vw, 24px)', minWidth: 0 }}>
      <div>
        <h1 style={{ fontSize: 'clamp(20px, 4vw, 24px)', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', marginBottom: 4 }}>
          Real User Monitoring (RUM)
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Client-side performance, Google Core Web Vitals, user journeys, and browser breakdown
        </p>
      </div>

      {/* Core Web Vitals Grid */}
      {vitals && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 16 }}>
          <WebVitalGauge name="LCP" fullName="Largest Contentful Paint" metric={vitals.lcp} description="Loading speed" />
          <WebVitalGauge name="INP" fullName="Interaction to Next Paint" metric={vitals.inp} description="Responsiveness" />
          <WebVitalGauge name="CLS" fullName="Cumulative Layout Shift" metric={vitals.cls} description="Visual stability" />
          <WebVitalGauge name="TTFB" fullName="Time to First Byte" metric={vitals.ttfb} description="Server response" />
          <WebVitalGauge name="FCP" fullName="First Contentful Paint" metric={vitals.fcp} description="First render" />
        </div>
      )}

      {/* Slow Pages Table */}
      <div className="glass-panel" style={{ padding: 'clamp(14px, 3vw, 20px)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', marginBottom: 14 }}>
          Page Performance & Route Timing Breakdown
        </h2>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <th style={{ padding: '10px 14px' }}>Route</th>
                <th style={{ padding: '10px 14px' }}>Page Views</th>
                <th style={{ padding: '10px 14px' }}>Avg Load</th>
                <th style={{ padding: '10px 14px' }}>P75 Load</th>
                <th style={{ padding: '10px 14px' }}>P95 Load</th>
                <th style={{ padding: '10px 14px' }}>Avg LCP</th>
                <th style={{ padding: '10px 14px' }}>Avg CLS</th>
              </tr>
            </thead>
            <tbody>
              {slowPages.map((page, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: 13, transition: 'background 0.15s ease' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-main)' }}>{page.route}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>{page.page_views.toLocaleString()}</td>
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>{page.avg_load_time_ms}ms</td>
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>{page.p75_load_time_ms}ms</td>
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: page.p95_load_time_ms > 1000 ? '#e11d48' : '#d97706' }}>
                    {page.p95_load_time_ms}ms
                  </td>
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>{page.avg_lcp_ms}ms</td>
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>{page.avg_cls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sessions Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedSession ? 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))' : '1fr', gap: 20 }}>
        {/* User Sessions List */}
        <div className="glass-panel" style={{ padding: 'clamp(14px, 3vw, 20px)' }}>

          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', marginBottom: 14 }}>
            Active Real User Sessions ({sessions.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sessions.map((sess) => {
              const isSel = selectedSession?.id === sess.id;
              return (
                <div
                  key={sess.id}
                  onClick={() => handleSelectSession(sess)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: isSel ? '#eef2ff' : 'var(--bg-primary)',
                    border: isSel ? '1px solid #c7d2fe' : '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {sess.device === 'Mobile' ? <Smartphone size={15} color="#0891b2" /> : <Monitor size={15} color="#4f46e5" />}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                        {sess.session_id}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {sess.browser} on {sess.os} • {sess.page_views_count} views
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                      {sess.duration_seconds}s
                    </span>
                    {sess.errors_count > 0 && (
                      <span className="badge badge-danger">{sess.errors_count} err</span>
                    )}
                    <ArrowRight size={14} color="var(--text-muted)" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Session Journey Replay Drawer */}
        {selectedSession && (
          <div className="glass-panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
                  Session Journey Replay
                </h3>
                <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {selectedSession.session_id} ({selectedSession.browser} / {selectedSession.os})
                </span>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, borderLeft: '2px solid #c7d2fe', paddingLeft: 16, marginLeft: 8 }}>
              {sessionTimeline.map((ev, idx) => (
                <div key={idx} style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: -22, top: 4, width: 10, height: 10, borderRadius: '50%', background: ev.status_code === 500 ? '#e11d48' : '#4f46e5' }} />
                  <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, color: ev.event_type === 'page_view' ? '#4f46e5' : (ev.status_code === 500 ? '#e11d48' : '#059669') }}>
                    {ev.event_type} {ev.status_code ? `[${ev.status_code}]` : ''}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)', wordBreak: 'break-all' }}>
                    {ev.url}
                  </div>
                  {ev.duration && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Latency: {ev.duration}ms
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
