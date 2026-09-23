import React from 'react';
import { ServiceMapData } from '../types';
import { Database, Server, Globe, ArrowRight } from 'lucide-react';

interface ServiceMapProps {
  data: ServiceMapData;
}

export const ServiceMap: React.FC<ServiceMapProps> = ({ data }) => {
  const getNodeIcon = (type: string, name: string) => {
    if (type === 'database' || name.includes('db')) return <Database size={16} color="#059669" />;
    if (type === 'server') return <Server size={16} color="#0891b2" />;
    return <Globe size={16} color="#4f46e5" />;
  };

  return (
    <div className="glass-panel" style={{ padding: '24px', overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>Live Service Dependency Map</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Real-time topology computed from distributed traces</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, fontWeight: 600 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#059669' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#059669' }} /> Healthy
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#e11d48' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e11d48' }} /> Errors Detected
          </span>
        </div>
      </div>

      {/* Visual Service Nodes Flow */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, minWidth: 680, padding: '20px 0' }}>
        {data.nodes.map((node, idx) => (
          <React.Fragment key={node.id}>
            {/* Node Card */}
            <div
              style={{
                background: 'var(--bg-card)',
                border: node.status === 'danger' ? '2px solid #e11d48' : '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: '18px 22px',
                minWidth: 165,
                textAlign: 'center',
                boxShadow: 'var(--shadow-md)',
                position: 'relative'
              }}
            >
              <div style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px'
              }}>
                {getNodeIcon(node.type, node.name)}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
                {node.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                {node.request_count} reqs
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, fontWeight: 700 }}>
                <span style={{ color: 'var(--accent-indigo)', fontFamily: 'var(--font-mono)' }}>{node.avg_latency_ms}ms</span>
                <span style={{ color: node.error_rate_percent > 0 ? '#e11d48' : '#059669' }}>
                  {node.error_rate_percent}% err
                </span>
              </div>
            </div>

            {/* Connecting Edge Arrow */}
            {idx < data.nodes.length - 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {data.edges[idx]?.avg_latency_ms || 24}ms
                </span>
                <div style={{ display: 'flex', alignItems: 'center', color: '#4f46e5' }}>
                  <div style={{ width: 36, height: 2, background: 'linear-gradient(90deg, #4f46e5, #0891b2)' }} />
                  <ArrowRight size={14} color="#0891b2" style={{ marginLeft: -4 }} />
                </div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
