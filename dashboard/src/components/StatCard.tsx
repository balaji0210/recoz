import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  accentColor?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subValue,
  icon: Icon,
  trend,
  accentColor = 'indigo'
}) => {
  const colorMap = {
    indigo: { text: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' },
    emerald: { text: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
    amber: { text: '#d97706', bg: '#fffbeb', border: '#fde68a' },
    rose: { text: '#e11d48', bg: '#fff1f2', border: '#fecdd3' },
    cyan: { text: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' }
  };

  const scheme = colorMap[accentColor];

  return (
    <div className="glass-panel" style={{ padding: 'clamp(14px, 2.5vw, 20px)', position: 'relative', overflow: 'hidden', minWidth: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{title}</span>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          background: scheme.bg,
          border: `1px solid ${scheme.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Icon size={17} color={scheme.text} />
        </div>
      </div>

      {/* Main Metric Value */}
      <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 'clamp(20px, 4vw, 26px)', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-main)', wordBreak: 'break-word' }}>
          {value}
        </span>
        {subValue && (
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', wordBreak: 'break-word' }}>
            {subValue}
          </span>
        )}
      </div>

      {/* Trend */}
      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, fontSize: 11, fontWeight: 600 }}>
          <span style={{ color: trend.isPositive ? '#059669' : '#e11d48' }}>
            {trend.isPositive ? '↑' : '↓'} {trend.value}
          </span>
          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>vs previous window</span>
        </div>
      )}
    </div>
  );
};
