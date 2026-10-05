import React, { useState } from 'react';
import { Activity, Clock, AlertTriangle, TrendingUp, Sparkles, Layers } from 'lucide-react';
import { TimeseriesBucket } from '../types';

interface ApmTimeseriesChartProps {
  buckets: TimeseriesBucket[];
  timeRange: string;
  onTimeRangeChange?: (range: string) => void;
  isLoading?: boolean;
}

type MetricMode = 'throughput' | 'latency' | 'errors' | 'vitals';

export const ApmTimeseriesChart: React.FC<ApmTimeseriesChartProps> = ({
  buckets,
  timeRange,
  onTimeRangeChange,
  isLoading = false
}) => {
  const [metricMode, setMetricMode] = useState<MetricMode>('throughput');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!buckets || buckets.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
        No timeseries telemetry available for this range.
      </div>
    );
  }

  // Extract primary values based on active metric mode
  const getDataPoints = () => {
    switch (metricMode) {
      case 'throughput':
        return buckets.map(b => b.page_views);
      case 'latency':
        return buckets.map(b => b.rum_p95_duration_ms);
      case 'errors':
        return buckets.map(b => b.spans_error_rate_percent);
      case 'vitals':
        return buckets.map(b => b.web_vitals.avg_lcp || 0);
    }
  };

  const getSecondaryPoints = () => {
    if (metricMode === 'latency') {
      return buckets.map(b => b.rum_avg_duration_ms);
    }
    if (metricMode === 'vitals') {
      return buckets.map(b => b.web_vitals.avg_ttfb || 0);
    }
    return null;
  };

  const primaryValues = getDataPoints();
  const secondaryValues = getSecondaryPoints();

  const maxVal = Math.max(...primaryValues, 1);
  const minVal = Math.min(...primaryValues);
  const avgVal = Math.round(primaryValues.reduce((a, b) => a + b, 0) / (primaryValues.length || 1));
  const latestVal = primaryValues[primaryValues.length - 1] ?? 0;

  // Chart configuration colors & units
  const config = {
    throughput: {
      label: 'Throughput (Pageviews & RPM)',
      unit: 'req/min',
      color: '#6366f1',
      gradientId: 'grad-throughput',
      badgeColor: 'rgba(99, 102, 241, 0.12)',
      icon: Activity
    },
    latency: {
      label: 'P95 & Avg Page Response Latency',
      unit: 'ms',
      color: '#10b981',
      secColor: '#06b6d4',
      gradientId: 'grad-latency',
      badgeColor: 'rgba(16, 185, 129, 0.12)',
      icon: Clock
    },
    errors: {
      label: 'Error Rate & Exception Spikes',
      unit: '%',
      color: '#f43f5e',
      gradientId: 'grad-errors',
      badgeColor: 'rgba(244, 63, 94, 0.12)',
      icon: AlertTriangle
    },
    vitals: {
      label: 'Core Web Vitals Rollup (LCP & TTFB)',
      unit: 'ms',
      color: '#8b5cf6',
      secColor: '#ec4899',
      gradientId: 'grad-vitals',
      badgeColor: 'rgba(139, 92, 246, 0.12)',
      icon: TrendingUp
    }
  }[metricMode];

  // SVG Geometry Dimensions
  const svgWidth = 840;
  const svgHeight = 220;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 30;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const pointsCount = primaryValues.length;
  const stepX = pointsCount > 1 ? chartWidth / (pointsCount - 1) : chartWidth;

  // Coordinate helper
  const getY = (val: number, maxV: number) => {
    const safeMax = maxV === 0 ? 1 : maxV * 1.15;
    return paddingTop + chartHeight - (val / safeMax) * chartHeight;
  };

  // Build SVG Path string
  const primaryCoords = primaryValues.map((val, idx) => ({
    x: paddingLeft + idx * stepX,
    y: getY(val, maxVal)
  }));

  // Create smooth bezier curve path
  const buildSmoothPath = (coords: { x: number; y: number }[]) => {
    if (coords.length === 0) return '';
    if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;

    let path = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i === 0 ? 0 : i - 1];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
  };

  const linePath = buildSmoothPath(primaryCoords);
  const areaPath = primaryCoords.length > 0
    ? `${linePath} L ${primaryCoords[primaryCoords.length - 1].x} ${paddingTop + chartHeight} L ${primaryCoords[0].x} ${paddingTop + chartHeight} Z`
    : '';

  // Secondary curve if present
  let secLinePath = '';
  if (secondaryValues) {
    const secCoords = secondaryValues.map((val, idx) => ({
      x: paddingLeft + idx * stepX,
      y: getY(val, maxVal)
    }));
    secLinePath = buildSmoothPath(secCoords);
  }

  // Hovered item calculations
  const activeBucket = hoveredIdx !== null && buckets[hoveredIdx] ? buckets[hoveredIdx] : null;
  const activeX = hoveredIdx !== null ? paddingLeft + hoveredIdx * stepX : null;

  return (
    <div className="glass-panel" style={{ padding: 'clamp(14px, 2.5vw, 24px)', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header controls & metric switcher tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: config.badgeColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: config.color
            }}>
              <config.icon size={16} />
            </span>
            <h2 style={{ fontSize: 'clamp(15px, 2vw, 17px)', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              {config.label}
            </h2>
            <span className="badge badge-indigo" style={{ fontSize: 10, padding: '2px 8px' }}>
              Live Rollup
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Correlated real-user telemetry, percentiles, and error frequency over discrete time windows
          </p>
        </div>

        {/* Metric Mode Pill Selectors */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, background: 'var(--bg-primary)', padding: 4, borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
          {[
            { id: 'throughput', label: 'Throughput (RPM)', icon: Activity },
            { id: 'latency', label: 'Latency (P95/Avg)', icon: Clock },
            { id: 'errors', label: 'Error Rate', icon: AlertTriangle },
            { id: 'vitals', label: 'Web Vitals', icon: TrendingUp }
          ].map(tab => {
            const active = metricMode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMetricMode(tab.id as MetricMode)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 7,
                  border: 'none',
                  background: active ? '#ffffff' : 'transparent',
                  color: active ? 'var(--text-main)' : 'var(--text-muted)',
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  boxShadow: active ? 'var(--shadow-sm)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <tab.icon size={13} color={active ? config.color : undefined} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* SVG Interactive Canvas */}
      <div
        style={{ position: 'relative', width: '100%', overflow: 'hidden' }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * svgWidth;
            const relX = mouseX - paddingLeft;
            if (relX >= 0 && relX <= chartWidth) {
              const idx = Math.round(relX / stepX);
              if (idx >= 0 && idx < pointsCount) {
                setHoveredIdx(idx);
              }
            }
          }}
        >
          <defs>
            {/* Soft gradient fill for area charts */}
            <linearGradient id={config.gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={config.color} stopOpacity="0.28" />
              <stop offset="60%" stopColor={config.color} stopOpacity="0.08" />
              <stop offset="100%" stopColor={config.color} stopOpacity="0.00" />
            </linearGradient>
            {/* Glow filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Horizontal gridlines & Y-axis labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const y = paddingTop + chartHeight * (1 - pct);
            const val = Math.round(maxVal * pct);
            return (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={paddingLeft + chartWidth}
                  y2={y}
                  stroke="var(--border-subtle)"
                  strokeDasharray={pct === 0 ? 'none' : '3 4'}
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                >
                  {val}{metricMode === 'errors' ? '%' : (metricMode === 'throughput' ? '' : 'ms')}
                </text>
              </g>
            );
          })}

          {/* Area under curve */}
          <path d={areaPath} fill={`url(#${config.gradientId})`} />

          {/* Secondary line (e.g. Avg duration or TTFB) */}
          {secLinePath && (
            <path
              d={secLinePath}
              fill="none"
              stroke={(config as any).secColor || '#06b6d4'}
              strokeWidth="1.8"
              strokeDasharray="4 4"
              opacity="0.8"
            />
          )}

          {/* Primary bezier curve line */}
          <path
            d={linePath}
            fill="none"
            stroke={config.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Hover Crosshair and Dot */}
          {hoveredIdx !== null && activeX !== null && (
            <g>
              <line
                x1={activeX}
                y1={paddingTop}
                x2={activeX}
                y2={paddingTop + chartHeight}
                stroke={config.color}
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.85"
              />
              <circle
                cx={activeX}
                cy={primaryCoords[hoveredIdx]?.y || paddingTop}
                r="6"
                fill={config.color}
                stroke="#ffffff"
                strokeWidth="2.5"
                filter="url(#glow)"
              />
            </g>
          )}

          {/* X-axis time labels */}
          {buckets.map((b, idx) => {
            // Render every 4th label to prevent clutter
            const interval = Math.ceil(pointsCount / 6);
            if (idx % interval !== 0 && idx !== pointsCount - 1) return null;
            const x = paddingLeft + idx * stepX;
            return (
              <text
                key={idx}
                x={x}
                y={paddingTop + chartHeight + 18}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize="10"
                fontFamily="var(--font-mono)"
              >
                {b.label}
              </text>
            );
          })}
        </svg>

        {/* Hover Glass Floating Tooltip */}
        {activeBucket && hoveredIdx !== null && activeX !== null && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: Math.min(Math.max(activeX - 80, 20), svgWidth - 190),
              background: 'var(--bg-glass)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '8px 12px',
              boxShadow: 'var(--shadow-md)',
              pointerEvents: 'none',
              zIndex: 30,
              minWidth: 160
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
              ⏰ {activeBucket.label} ({timeRange})
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: config.color }}>
                {metricMode === 'throughput' && `${activeBucket.page_views} page views`}
                {metricMode === 'latency' && `P95: ${activeBucket.rum_p95_duration_ms}ms`}
                {metricMode === 'errors' && `Errors: ${activeBucket.spans_error_rate_percent}%`}
                {metricMode === 'vitals' && `LCP: ${activeBucket.web_vitals.avg_lcp || 0}ms`}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {metricMode === 'latency' && `(Avg ${activeBucket.rum_avg_duration_ms}ms)`}
                {metricMode === 'vitals' && `(TTFB ${activeBucket.web_vitals.avg_ttfb || 0}ms)`}
                {metricMode === 'throughput' && `${activeBucket.spans_count} spans`}
                {metricMode === 'errors' && `${activeBucket.error_events_count} events`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Metric Summary Statistics Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))',
        gap: 12,
        paddingTop: 14,
        borderTop: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>CURRENT VALUE</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: config.color, fontFamily: 'var(--font-mono)' }}>
            {latestVal} {config.unit}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>AVERAGE</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
            {avgVal} {config.unit}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>PEAK / MAX</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#e11d48', fontFamily: 'var(--font-mono)' }}>
            {maxVal} {config.unit}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>INTERVAL RESOLUTION</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>
            {timeRange === '1h' ? '2-min rollups' : (timeRange === '6h' ? '10-min rollups' : '1-hour buckets')}
          </span>
        </div>
      </div>
    </div>
  );
};
