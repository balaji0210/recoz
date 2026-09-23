import React from 'react';
import { WebVitalMetric } from '../types';

interface WebVitalGaugeProps {
  name: string;
  fullName: string;
  metric: WebVitalMetric;
  description: string;
}

export const WebVitalGauge: React.FC<WebVitalGaugeProps> = ({
  name,
  fullName,
  metric,
  description
}) => {
  const getBadgeClass = (rating: string) => {
    switch (rating) {
      case 'GOOD': return 'badge-good';
      case 'NEEDS_IMPROVEMENT': return 'badge-warning';
      case 'POOR': return 'badge-poor';
      default: return 'badge-info';
    }
  };

  const getProgressPercent = () => {
    if (metric.value === null) return 0;
    if (metric.unit === 'score') {
      return Math.min(100, Math.round((metric.value / 0.25) * 100));
    }
    return Math.min(100, Math.round((metric.value / (metric.good_threshold * 2)) * 100));
  };

  const getBarColor = (rating: string) => {
    switch (rating) {
      case 'GOOD': return '#059669';
      case 'NEEDS_IMPROVEMENT': return '#d97706';
      case 'POOR': return '#e11d48';
      default: return '#4f46e5';
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fullName}</span>
          </div>
          <span className={`badge ${getBadgeClass(metric.rating)}`}>
            {metric.rating.replace('_', ' ')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '10px 0 12px' }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-main)' }}>
            {metric.value !== null ? metric.value : '--'}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
            {metric.unit}
          </span>
        </div>
      </div>

      <div>
        {/* Progress Bar */}
        <div style={{ width: '100%', height: 6, background: 'var(--border-subtle)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
          <div
            style={{
              height: '100%',
              width: `${getProgressPercent()}%`,
              background: getBarColor(metric.rating),
              borderRadius: 3,
              transition: 'width 0.4s ease'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
          <span>Target: ≤ {metric.good_threshold} {metric.unit}</span>
          <span>{description}</span>
        </div>
      </div>
    </div>
  );
};
