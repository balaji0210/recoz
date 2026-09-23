import React, { useState } from 'react';
import { TraceWaterfallData, SpanNode } from '../types';
import { ChevronRight, ChevronDown, AlertTriangle, CheckCircle2, Clock, Database, Server, Globe } from 'lucide-react';

interface TraceWaterfallProps {
  waterfall: TraceWaterfallData;
}

export const TraceWaterfall: React.FC<TraceWaterfallProps> = ({ waterfall }) => {
  const [expandedSpanId, setExpandedSpanId] = useState<string | null>(null);

  const getServiceColor = (svc: string) => {
    if (svc.includes('front') || svc.includes('web') || svc.includes('client')) return { bar: '#4f46e5', text: '#4338ca', bg: '#eef2ff' };
    if (svc.includes('node') || svc.includes('gate') || svc.includes('api')) return { bar: '#0891b2', text: '#0e7490', bg: '#ecfeff' };
    if (svc.includes('py') || svc.includes('auth')) return { bar: '#7c3aed', text: '#6d28d9', bg: '#f5f3ff' };
    if (svc.includes('db') || svc.includes('post') || svc.includes('sql')) return { bar: '#059669', text: '#047857', bg: '#ecfdf5' };
    return { bar: '#d97706', text: '#b45309', bg: '#fffbeb' };
  };

  const getKindIcon = (kind: string, svc: string) => {
    if (svc.includes('db') || svc.includes('sql')) return <Database size={13} />;
    if (kind === 'server') return <Server size={13} />;
    return <Globe size={13} />;
  };

  const renderSpanRow = (span: SpanNode, depth: number = 0): React.ReactNode => {
    const isSelected = expandedSpanId === span.span_id;
    const colors = getServiceColor(span.service_name);
    const hasError = span.status_code === 'ERROR';

    return (
      <React.Fragment key={span.span_id}>
        <div
          onClick={() => setExpandedSpanId(isSelected ? null : span.span_id)}
          style={{
            display: 'grid',
            gridTemplateColumns: '320px 1fr 110px',
            alignItems: 'center',
            padding: '11px 16px',
            background: isSelected ? '#eef2ff' : (depth % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-primary)'),
            borderBottom: '1px solid var(--border-subtle)',
            cursor: 'pointer',
            transition: 'background 0.15s ease'
          }}
        >
          {/* Service & Operation Column */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: depth * 20, overflow: 'hidden' }}>
            <span style={{ color: colors.text, display: 'flex', alignItems: 'center' }}>
              {getKindIcon(span.kind, span.service_name)}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 4,
                background: colors.bg,
                color: colors.text,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                border: `1px solid ${colors.text}33`
              }}
            >
              {span.service_name}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: hasError ? '#e11d48' : 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {span.name}
            </span>
          </div>

          {/* Waterfall Timeline Bar */}
          <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center', padding: '0 8px' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, height: 4, background: 'var(--border-subtle)', borderRadius: 2 }} />
            <div
              style={{
                position: 'absolute',
                left: `${span.offset_percent}%`,
                width: `${Math.max(2, span.duration_percent)}%`,
                height: 10,
                background: hasError ? '#e11d48' : colors.bar,
                borderRadius: 4,
                boxShadow: `0 1px 4px ${hasError ? 'rgba(225, 29, 72, 0.4)' : colors.bar + '40'}`
              }}
            />
          </div>

          {/* Duration & Status */}
          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
              {span.duration_ms}ms
            </span>
            {hasError ? (
              <AlertTriangle size={14} color="#e11d48" />
            ) : (
              <CheckCircle2 size={14} color="#059669" />
            )}
          </div>
        </div>

        {/* Expanded Span Attributes Drawer */}
        {isSelected && (
          <div style={{ padding: '16px 20px', background: 'var(--bg-code)', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={13} color="var(--accent-indigo)" />
              Span Details & OpenTelemetry Attributes
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 12, fontSize: 11 }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Span ID:</span> <span className="font-mono" style={{ color: 'var(--text-main)' }}>{span.span_id}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Parent ID:</span> <span className="font-mono" style={{ color: 'var(--text-main)' }}>{span.parent_span_id || 'Root Span'}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Offset:</span> <span className="font-mono" style={{ color: 'var(--text-main)' }}>{span.offset_ms}ms ({span.offset_percent}%)</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Duration:</span> <span className="font-mono" style={{ color: 'var(--text-main)' }}>{span.duration_ms}ms ({span.duration_percent}%)</span></div>
            </div>

            {span.attributes && Object.keys(span.attributes).length > 0 && (
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: 4 }}>Attributes:</span>
                <pre style={{
                  background: 'var(--bg-card)',
                  padding: '10px 14px',
                  borderRadius: 6,
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  fontSize: 11,
                  overflowX: 'auto',
                  fontFamily: 'var(--font-mono)'
                }}>
                  {JSON.stringify(span.attributes, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {span.children && span.children.map(c => renderSpanRow(c, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="glass-panel" style={{ overflow: 'hidden' }}>
      {/* Root Cause Bottleneck Banner */}
      {waterfall.root_cause_hint && (
        <div style={{
          padding: '14px 20px',
          background: waterfall.root_cause_hint.type === 'BOTTLENECK' ? '#fffbeb' : '#fff1f2',
          borderBottom: `1px solid ${waterfall.root_cause_hint.type === 'BOTTLENECK' ? '#fde68a' : '#fecdd3'}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <AlertTriangle size={18} color={waterfall.root_cause_hint.type === 'BOTTLENECK' ? '#d97706' : '#e11d48'} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: waterfall.root_cause_hint.type === 'BOTTLENECK' ? '#92400e' : '#9f1239' }}>
              Automated Root Cause Diagnosis: {waterfall.root_cause_hint.type}
            </div>
            <div style={{ fontSize: 12, color: waterfall.root_cause_hint.type === 'BOTTLENECK' ? '#b45309' : '#be123c' }}>
              {waterfall.root_cause_hint.message}
            </div>
          </div>
        </div>
      )}

      {/* Waterfall Table Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr 110px',
        padding: '10px 16px',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-subtle)',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--text-muted)'
      }}>
        <div>Service & Span Hierarchy</div>
        <div>Timeline & Offsets ({waterfall.total_duration_ms}ms total)</div>
        <div style={{ textAlign: 'right' }}>Duration</div>
      </div>

      {/* Render Spans */}
      <div>
        {waterfall.root_spans.map(s => renderSpanRow(s, 0))}
      </div>
    </div>
  );
};
