import React, { useState, useEffect } from 'react';
import { GitMerge, Layers, Clock, AlertTriangle, ArrowRight, Activity, Search } from 'lucide-react';
import { TraceWaterfall } from '../components/TraceWaterfall';
import { ServiceMap } from '../components/ServiceMap';
import { api } from '../api/client';
import { TraceWaterfallData, ServiceMapData } from '../types';

interface TracesPageProps {
  appId: string;
}

export const TracesPage: React.FC<TracesPageProps> = ({ appId }) => {
  const [activeView, setActiveView] = useState<'transactions' | 'service_map'>('transactions');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [waterfall, setWaterfall] = useState<TraceWaterfallData | null>(null);
  const [serviceMap, setServiceMap] = useState<ServiceMapData | null>(null);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);

  useEffect(() => {
    loadTraceData();
  }, [appId]);

  const loadTraceData = async () => {
    try {
      const [txs, sm] = await Promise.all([
        api.getTransactions(appId),
        api.getServiceMap(appId)
      ]);
      setTransactions(txs);
      setServiceMap(sm);

      const wf = await api.getTraceWaterfall('trace_demo_sample_1');
      setWaterfall(wf);
      if (txs.length > 0) setSelectedTx(txs[0]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectTransaction = async (tx: any) => {
    setSelectedTx(tx);
    try {
      const wf = await api.getTraceWaterfall(`trace_${tx.name.replace(/[^a-zA-Z0-9]/g, '_')}`);
      setWaterfall(wf);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', marginBottom: 4 }}>
            Transactions & Distributed Traces
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            End-to-end distributed tracing across microservices with automated root cause identification
          </p>
        </div>

        {/* View Switcher */}
        <div style={{ display: 'flex', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 3 }}>
          <button
            onClick={() => setActiveView('transactions')}
            style={{
              background: activeView === 'transactions' ? '#ffffff' : 'transparent',
              color: activeView === 'transactions' ? 'var(--accent-indigo)' : 'var(--text-muted)',
              boxShadow: activeView === 'transactions' ? 'var(--shadow-sm)' : 'none',
              border: 'none',
              borderRadius: 6,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Waterfall Explorer
          </button>
          <button
            onClick={() => setActiveView('service_map')}
            style={{
              background: activeView === 'service_map' ? '#ffffff' : 'transparent',
              color: activeView === 'service_map' ? 'var(--accent-indigo)' : 'var(--text-muted)',
              boxShadow: activeView === 'service_map' ? 'var(--shadow-sm)' : 'none',
              border: 'none',
              borderRadius: 6,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Service Map
          </button>
        </div>
      </div>

      {activeView === 'service_map' && serviceMap ? (
        <ServiceMap data={serviceMap} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, alignItems: 'start' }}>
          {/* Transactions List */}
          <div className="glass-panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', padding: '4px 6px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
              Top Monitored Operations
            </h3>

            {transactions.map((tx, idx) => {
              const isSel = selectedTx?.name === tx.name;
              return (
                <div
                  key={idx}
                  onClick={() => handleSelectTransaction(tx)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: isSel ? '#eef2ff' : 'var(--bg-primary)',
                    border: isSel ? '1px solid #c7d2fe' : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="badge badge-info">{tx.service}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{tx.request_count.toLocaleString()} reqs</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
                    {tx.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>Avg: <strong style={{ color: 'var(--text-main)' }}>{tx.avg_duration_ms}ms</strong></span>
                    <span>P95: <strong style={{ color: tx.p95_duration_ms > 500 ? '#e11d48' : '#d97706' }}>{tx.p95_duration_ms}ms</strong></span>
                    <span style={{ color: tx.error_rate_percent > 0 ? '#e11d48' : '#059669', fontWeight: 700 }}>
                      {tx.error_rate_percent}% err
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trace Waterfall Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {selectedTx && (
              <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                    Selected Trace Transaction
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>
                    {selectedTx.name}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 20 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Duration</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                      {waterfall?.total_duration_ms}ms
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Spans Recorded</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent-indigo)' }}>
                      {waterfall?.span_count} spans
                    </div>
                  </div>
                </div>
              </div>
            )}

            {waterfall ? (
              <TraceWaterfall waterfall={waterfall} />
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading trace waterfall...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
