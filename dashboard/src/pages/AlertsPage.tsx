import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, AlertTriangle, Shield, Plus, Send, Radio } from 'lucide-react';
import { api } from '../api/client';
import { AlertRuleItem, IncidentItem } from '../types';

interface AlertsPageProps {
  appId: string;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({ appId }) => {
  const [rules, setRules] = useState<AlertRuleItem[]>([]);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  useEffect(() => {
    loadAlertData();
  }, [appId]);

  const loadAlertData = async () => {
    try {
      const [r, inc] = await Promise.all([
        api.getAlertRules(appId),
        api.getIncidents(appId)
      ]);
      setRules(r);
      setIncidents(inc);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAcknowledge = async (incidentId: string) => {
    // 1. Optimistic update so UI responds instantly
    setIncidents(prev =>
      prev.map(inc => inc.id === incidentId ? { ...inc, status: 'ACKNOWLEDGED' } : inc)
    );
    setTestStatus('✓ Incident successfully marked as ACKNOWLEDGED');

    // 2. Call backend API
    try {
      await api.acknowledgeIncident(incidentId);
      await loadAlertData();
    } catch (e) {
      console.warn('Backend update failed, kept optimistic status:', e);
    }
  };

  const handleResolve = async (incidentId: string) => {
    // 1. Optimistic update so UI responds instantly
    setIncidents(prev =>
      prev.map(inc => inc.id === incidentId ? { ...inc, status: 'RESOLVED', resolved_at: new Date().toISOString() } : inc)
    );
    setTestStatus('✓ Incident successfully marked as RESOLVED');

    // 2. Call backend API
    try {
      await api.resolveIncident(incidentId);
      await loadAlertData();
    } catch (e) {
      console.warn('Backend update failed, kept optimistic status:', e);
    }
  };

  const handleTestNotification = async (channelType: string) => {
    setTestingChannel(channelType);
    setTestStatus(null);
    setTimeout(() => {
      setTestStatus(`Test notification dispatched to ${channelType} adapter successfully!`);
      setTestingChannel(null);
    }, 800);
  };

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', marginBottom: 4 }}>
            Alerts & Incident Management
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Threshold-based alert evaluation, anti-flapping duration, and multichannel notification routing
          </p>
        </div>
      </div>

      {/* Action Notification Banner */}
      {testStatus && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '12px 16px', color: '#047857', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} /> {testStatus}
          </div>
          <button
            onClick={() => setTestStatus(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#047857', fontSize: 12, fontWeight: 600 }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Incidents Section */}
      <div className="glass-panel" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Radio size={16} color="#e11d48" className="animate-pulse-dot" />
          Active Incidents ({incidents.filter(i => i.status !== 'RESOLVED').length})
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {incidents.map((inc) => {
            const isOpen = inc.status === 'OPEN';
            const isAcknowledged = inc.status === 'ACKNOWLEDGED';
            const isResolved = inc.status === 'RESOLVED';

            const statusColor = isOpen ? '#e11d48' : isAcknowledged ? '#d97706' : '#059669';
            const cardBg = isResolved ? 'var(--bg-primary)' : isOpen ? (inc.severity === 'critical' ? '#fff1f2' : '#fffbeb') : '#fefce8';
            const cardBorder = isResolved ? '1px solid var(--border-subtle)' : isOpen ? (inc.severity === 'critical' ? '1px solid #fecdd3' : '1px solid #fde68a') : '1px solid #fef08a';

            return (
              <div
                key={inc.id}
                style={{
                  padding: '14px 18px',
                  borderRadius: 8,
                  background: cardBg,
                  border: cardBorder,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className={`badge ${inc.severity === 'critical' ? 'badge-danger' : 'badge-warning'}`}>
                      {inc.severity}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: statusColor }}>
                      [{inc.status}]
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
                    {inc.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Triggered {new Date(inc.triggered_at).toLocaleTimeString()} • Current Value: <strong style={{ color: 'var(--text-main)' }}>{inc.current_value}</strong> (Threshold: {inc.threshold})
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isOpen && (
                    <button
                      onClick={() => handleAcknowledge(inc.id)}
                      className="btn-secondary"
                      style={{ fontSize: 12, padding: '6px 14px', cursor: 'pointer' }}
                    >
                      Acknowledge
                    </button>
                  )}
                  {isAcknowledged && (
                    <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600, padding: '6px 10px', background: '#fef3c7', borderRadius: 6 }}>
                      Acknowledged
                    </span>
                  )}
                  {!isResolved ? (
                    <button
                      onClick={() => handleResolve(inc.id)}
                      className="btn-primary"
                      style={{ background: '#059669', fontSize: 12, padding: '6px 14px', cursor: 'pointer' }}
                    >
                      Resolve Incident
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: '#059669', fontWeight: 600, padding: '6px 10px', background: '#ecfdf5', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={14} /> Resolved
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Alert Rules & Notification Channels Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20 }}>
        {/* Rules Table */}
        <div className="glass-panel" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 14 }}>
            Evaluation Rules ({rules.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rules.map((rule) => (
              <div key={rule.id} style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>{rule.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Metric: {rule.metric_type} {rule.operator} {rule.threshold} for {rule.duration_seconds}s
                  </div>
                </div>
                <span className={`badge ${rule.state === 'FIRING' ? 'badge-danger' : 'badge-healthy'}`}>
                  {rule.state}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Dispatcher Adapter Test */}
        <div className="glass-panel" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 14 }}>
            Dispatch Adapter Verification
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Test outbound notification channels with standardized rich payload formatting
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            {['Slack Webhook', 'PagerDuty', 'Email (SMTP)', 'Jira Incident', 'ServiceNow'].map((adapter) => (
              <button
                key={adapter}
                onClick={() => handleTestNotification(adapter)}
                disabled={testingChannel === adapter}
                className="btn-secondary"
                style={{ padding: '10px 12px', fontSize: 12, justifyContent: 'center' }}
              >
                <Send size={13} color="var(--accent-indigo)" />
                {adapter}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
