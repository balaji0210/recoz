import React from 'react';
import { Database, Cpu, Radio, Shield, CheckCircle2, Zap } from 'lucide-react';

interface TelemetryStatusStripProps {
  uptimeSeconds?: number;
  appsCount?: number;
  spansCount?: number;
}

export const TelemetryStatusStrip: React.FC<TelemetryStatusStripProps> = ({
  uptimeSeconds = 3600,
  appsCount = 1,
  spansCount = 68
}) => {
  const formatUptime = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  const services = [
    {
      name: 'RUM & Telemetry Ingest',
      status: 'ONLINE',
      detail: 'Port 8000 • 1,200 req/min cap',
      icon: Radio,
      color: '#10b981'
    },
    {
      name: 'OTel Trace Waterfall Engine',
      status: 'HEALTHY',
      detail: 'Span correlation & root-cause',
      icon: Zap,
      color: '#6366f1'
    },
    {
      name: 'Alert State Machine',
      status: 'ACTIVE',
      detail: 'APScheduler • 30s interval',
      icon: Cpu,
      color: '#06b6d4'
    },
    {
      name: 'Telemetry DB Store',
      status: 'HEALTHY',
      detail: 'SQLite WAL • AsyncIO Pool',
      icon: Database,
      color: '#10b981'
    }
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
      gap: 12
    }}>
      {services.map((srv, idx) => (
        <div
          key={idx}
          className="glass-panel"
          style={{
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-primary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `${srv.color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: srv.color
            }}>
              <srv.icon size={16} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>
                {srv.name}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {srv.detail}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: srv.color,
              boxShadow: `0 0 6px ${srv.color}`
            }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: srv.color }}>
              {srv.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
