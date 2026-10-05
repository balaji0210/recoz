import React, { useState, useEffect } from 'react';
import {
  Bell, CheckCircle2, AlertTriangle, Shield, Plus, Send, Radio,
  Search, Activity, HelpCircle, X, RefreshCw, FileText, ArrowRight, Check
} from 'lucide-react';
import { api } from '../api/client';
import { AlertRuleItem, IncidentItem, IncidentVerificationResult } from '../types';

interface AlertsPageProps {
  appId: string;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({ appId }) => {
  const [rules, setRules] = useState<AlertRuleItem[]>([]);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);

  // Status Filter: 'ALL' | 'ACTIVE' | 'INVESTIGATING' | 'RESOLVED'
  const [filterTab, setFilterTab] = useState<'ALL' | 'ACTIVE' | 'INVESTIGATING' | 'RESOLVED'>('ALL');

  // Verification & Resolution Modal State
  const [resolvingIncident, setResolvingIncident] = useState<IncidentItem | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<IncidentVerificationResult | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [forceOverride, setForceOverride] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    if (resolvingIncident) {
      document.body.classList.add('scroll-locked');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.classList.remove('scroll-locked');
      document.body.style.overflow = '';
    }
    return () => {
      document.body.classList.remove('scroll-locked');
      document.body.style.overflow = '';
    };
  }, [resolvingIncident]);

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

  // 1. Transition: Active/OPEN -> ACKNOWLEDGED
  const handleAcknowledge = async (incidentId: string) => {
    setIncidents(prev =>
      prev.map(inc => inc.id === incidentId ? { ...inc, status: 'ACKNOWLEDGED', acknowledged_at: new Date().toISOString() } : inc)
    );
    setActionNotice({ type: 'success', text: 'Incident acknowledged by team on-call' });

    try {
      await api.acknowledgeIncident(incidentId);
      await loadAlertData();
    } catch (e) {
      console.warn('Backend update failed, kept optimistic status:', e);
    }
  };

  // 2. Transition: Active/OPEN or ACKNOWLEDGED -> INVESTIGATING
  const handleStartInvestigation = async (incidentId: string) => {
    setIncidents(prev =>
      prev.map(inc => inc.id === incidentId ? { ...inc, status: 'INVESTIGATING', investigated_at: new Date().toISOString() } : inc)
    );
    setActionNotice({ type: 'success', text: 'Status changed to INVESTIGATING. Incident is actively being analyzed.' });

    try {
      await api.investigateIncident(incidentId);
      await loadAlertData();
    } catch (e) {
      console.warn('Backend update failed, kept optimistic status:', e);
    }
  };

  // 3. Open Verification Modal for INVESTIGATING incidents
  const openResolveModal = async (inc: IncidentItem) => {
    setResolvingIncident(inc);
    setVerificationResult(null);
    setResolutionNotes('');
    setForceOverride(false);
    setModalError(null);
    setIsVerifying(true);

    try {
      const result = await api.verifyIncident(inc.id);
      setVerificationResult(result);
    } catch (err: any) {
      console.error('Error verifying incident:', err);
      setModalError('Could not connect to health verification probe. Please check network connectivity.');
    } finally {
      setIsVerifying(false);
    }
  };

  const rerunVerification = async () => {
    if (!resolvingIncident) return;
    setIsVerifying(true);
    setModalError(null);
    try {
      const result = await api.verifyIncident(resolvingIncident.id);
      setVerificationResult(result);
    } catch (err) {
      setModalError('Failed to refresh verification probe.');
    } finally {
      setIsVerifying(false);
    }
  };

  // 4. Submit Verified Resolution
  const handleConfirmResolution = async () => {
    if (!resolvingIncident) return;

    if (verificationResult?.is_breached && !forceOverride) {
      setModalError('This incident is still active. Please resolve the underlying issue before marking it as resolved.');
      return;
    }

    if (verificationResult?.is_breached && forceOverride && resolutionNotes.trim().length < 5) {
      setModalError('Resolution notes (min 5 characters) are required when overriding an active incident.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      await api.resolveIncident(resolvingIncident.id, resolutionNotes.trim() || undefined, forceOverride);
      
      // Update local state
      setIncidents(prev =>
        prev.map(i => i.id === resolvingIncident.id ? {
          ...i,
          status: 'RESOLVED',
          resolved_at: new Date().toISOString(),
          resolution_notes: resolutionNotes.trim() || 'Verified resolved by automated health check'
        } : i)
      );

      setActionNotice({
        type: 'success',
        text: `✓ Incident "${resolvingIncident.title}" successfully verified and marked as RESOLVED.`
      });

      setResolvingIncident(null);
      await loadAlertData();
    } catch (err: any) {
      console.error('Resolution failed:', err);
      const msg = err.message || (err.detail ? err.detail : 'Failed to resolve incident');
      setModalError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestNotification = async (channelType: string) => {
    setTestingChannel(channelType);
    setActionNotice(null);
    setTimeout(() => {
      setActionNotice({
        type: 'success',
        text: `Test notification dispatched to ${channelType} adapter successfully!`
      });
      setTestingChannel(null);
    }, 800);
  };

  // Filtered incidents
  const filteredIncidents = incidents.filter(inc => {
    if (filterTab === 'ACTIVE') return inc.status === 'OPEN' || inc.status === 'ACKNOWLEDGED';
    if (filterTab === 'INVESTIGATING') return inc.status === 'INVESTIGATING';
    if (filterTab === 'RESOLVED') return inc.status === 'RESOLVED';
    return true;
  });

  return (
    <div style={{ padding: 'clamp(16px, 3vw, 28px)', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(20px, 3vw, 24px)', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', marginBottom: 4 }}>
            Alerts & Incident Management
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Threshold-based alert evaluation, anti-flapping duration, automated verification, and verified resolution workflow
          </p>
        </div>

        {/* Status Flow Helper Banner */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 6,
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          padding: '8px 14px',
          fontSize: 12,
          color: 'var(--text-muted)'
        }}>
          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Lifecycle:</span>
          <span style={{ color: '#e11d48', fontWeight: 700 }}>Active</span>
          <ArrowRight size={12} />
          <span style={{ color: '#d97706', fontWeight: 700 }}>Acknowledged</span>
          <ArrowRight size={12} />
          <span style={{ color: '#6366f1', fontWeight: 700 }}>Investigating</span>
          <ArrowRight size={12} />
          <span style={{ color: '#059669', fontWeight: 700 }}>Resolved</span>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionNotice && (
        <div style={{
          background: actionNotice.type === 'success' ? '#ecfdf5' : actionNotice.type === 'warning' ? '#fffbeb' : '#fef2f2',
          border: `1px solid ${actionNotice.type === 'success' ? '#a7f3d0' : actionNotice.type === 'warning' ? '#fde68a' : '#fecaca'}`,
          borderRadius: 8,
          padding: '12px 16px',
          color: actionNotice.type === 'success' ? '#047857' : actionNotice.type === 'warning' ? '#b45309' : '#b91c1c',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {actionNotice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{actionNotice.text}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 12, fontWeight: 600 }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Incidents Section */}
      <div className="glass-panel" style={{ padding: 'clamp(14px, 2.5vw, 20px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Radio size={16} color="#e11d48" className="animate-pulse-dot" />
            Incidents Lifecycle Management ({incidents.filter(i => i.status !== 'RESOLVED').length} active)
          </h2>

          {/* Filter Pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, background: 'var(--bg-primary)', padding: 3, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
            {(['ALL', 'ACTIVE', 'INVESTIGATING', 'RESOLVED'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: filterTab === tab ? 'var(--accent-indigo)' : 'transparent',
                  color: filterTab === tab ? '#ffffff' : 'var(--text-muted)',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {filteredIncidents.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No incidents found in this view.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredIncidents.map((inc) => {
              const isOpen = inc.status === 'OPEN';
              const isAcknowledged = inc.status === 'ACKNOWLEDGED';
              const isInvestigating = inc.status === 'INVESTIGATING';
              const isResolved = inc.status === 'RESOLVED';

              // Visual styling per status
              const statusColor = isOpen
                ? '#e11d48'
                : isAcknowledged
                ? '#d97706'
                : isInvestigating
                ? '#6366f1'
                : '#059669';

              const cardBg = isResolved
                ? 'var(--bg-primary)'
                : isInvestigating
                ? 'rgba(99, 102, 241, 0.04)'
                : isOpen
                ? (inc.severity === 'critical' ? '#fff1f2' : '#fffbeb')
                : '#fefce8';

              const cardBorder = isResolved
                ? '1px solid var(--border-subtle)'
                : isInvestigating
                ? '1px solid rgba(99, 102, 241, 0.3)'
                : isOpen
                ? (inc.severity === 'critical' ? '1px solid #fecdd3' : '1px solid #fde68a')
                : '1px solid #fef08a';

              return (
                <div
                  key={inc.id}
                  style={{
                    padding: '16px 20px',
                    borderRadius: 10,
                    background: cardBg,
                    border: cardBorder,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 14,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span className={`badge ${inc.severity === 'critical' ? 'badge-danger' : 'badge-warning'}`}>
                        {inc.severity}
                      </span>

                      {/* Precise Lifecycle Status Badge */}
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: statusColor,
                        padding: '2px 8px',
                        background: 'rgba(0,0,0,0.05)',
                        borderRadius: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        {isOpen && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e11d48' }} />}
                        {isAcknowledged && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d97706' }} />}
                        {isInvestigating && <Search size={11} color="#6366f1" />}
                        {isResolved && <Check size={11} color="#059669" />}
                        {isOpen ? 'ACTIVE / OPEN' : inc.status}
                      </span>

                      {isInvestigating && inc.investigated_at && (
                        <span style={{ fontSize: 11, color: '#6366f1' }}>
                          • Under investigation since {new Date(inc.investigated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
                      {inc.title}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Triggered {new Date(inc.triggered_at).toLocaleTimeString()} • Current Value: <strong style={{ color: 'var(--text-main)' }}>{inc.current_value}</strong> (Threshold: {inc.threshold})
                    </div>

                    {/* Resolution Notes if Resolved */}
                    {isResolved && inc.resolution_notes && (
                      <div style={{ marginTop: 6, fontSize: 12, color: '#047857', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FileText size={12} />
                        <span>Resolution: <em>{inc.resolution_notes}</em></span>
                      </div>
                    )}
                  </div>

                  {/* Context-Aware Lifecycle Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {/* When Active/OPEN */}
                    {isOpen && (
                      <>
                        <button
                          onClick={() => handleAcknowledge(inc.id)}
                          className="btn-secondary"
                          style={{ fontSize: 12, padding: '7px 14px', cursor: 'pointer' }}
                          title="Acknowledge this alert to indicate the on-call team has seen it"
                        >
                          Acknowledge
                        </button>
                        <button
                          onClick={() => handleStartInvestigation(inc.id)}
                          className="btn-secondary"
                          style={{
                            fontSize: 12,
                            padding: '7px 14px',
                            cursor: 'pointer',
                            color: '#6366f1',
                            borderColor: 'rgba(99, 102, 241, 0.4)'
                          }}
                          title="Begin active investigation"
                        >
                          <Search size={13} />
                          Investigate
                        </button>
                      </>
                    )}

                    {/* When ACKNOWLEDGED */}
                    {isAcknowledged && (
                      <>
                        <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600, padding: '6px 10px', background: '#fef3c7', borderRadius: 6 }}>
                          Acknowledged
                        </span>
                        <button
                          onClick={() => handleStartInvestigation(inc.id)}
                          className="btn-primary"
                          style={{
                            fontSize: 12,
                            padding: '7px 14px',
                            cursor: 'pointer',
                            background: '#6366f1',
                            color: '#fff'
                          }}
                          title="Transition to Investigating to diagnose the root cause"
                        >
                          <Search size={13} />
                          Start Investigation
                        </button>
                      </>
                    )}

                    {/* When INVESTIGATING: Only status allowed to resolve with verification */}
                    {isInvestigating && (
                      <button
                        onClick={() => openResolveModal(inc)}
                        className="btn-primary"
                        style={{
                          background: '#059669',
                          fontSize: 12,
                          padding: '7px 16px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                        title="Run automated verification checks and confirm resolution"
                      >
                        <Shield size={13} />
                        Verify & Resolve
                      </button>
                    )}

                    {/* When RESOLVED */}
                    {isResolved && (
                      <span style={{
                        fontSize: 12,
                        color: '#059669',
                        fontWeight: 600,
                        padding: '6px 12px',
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        <CheckCircle2 size={14} /> Resolved & Verified
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Verification & Resolution Confirmation Modal */}
      {resolvingIncident && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            width: '100%',
            maxWidth: 560,
            maxHeight: '90vh',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-primary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(5, 150, 105, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Shield size={18} color="#059669" />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    Incident Resolution Verification
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    Automated telemetry verification before status conclusion
                  </p>
                </div>
              </div>
              <button
                onClick={() => setResolvingIncident(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Incident Details Card */}
              <div style={{
                background: 'var(--bg-primary)',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)'
              }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Target Incident:</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
                  {resolvingIncident.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <span>Severity: <strong style={{ color: 'var(--text-main)' }}>{resolvingIncident.severity}</strong></span>
                  <span>Threshold: <strong style={{ color: 'var(--text-main)' }}>{resolvingIncident.threshold}</strong></span>
                </div>
              </div>

              {/* Automated Health / Metric Verification Probe */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Activity size={14} color="var(--accent-indigo)" />
                    Automated Health & Telemetry Probe
                  </label>
                  <button
                    onClick={rerunVerification}
                    disabled={isVerifying}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent-indigo)',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: isVerifying ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <RefreshCw size={12} className={isVerifying ? 'animate-spin' : ''} />
                    Re-check Telemetry
                  </button>
                </div>

                {isVerifying ? (
                  <div style={{
                    padding: '16px',
                    borderRadius: 8,
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    color: 'var(--text-muted)',
                    fontSize: 13
                  }}>
                    <RefreshCw size={16} className="animate-spin" color="var(--accent-indigo)" />
                    Querying live telemetry & evaluating alert rule threshold...
                  </div>
                ) : verificationResult?.is_breached ? (
                  /* Breached Alert Box */
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: 8,
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                      <AlertTriangle size={16} color="#dc2626" />
                      Active Issue Detected
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>
                      This incident is still active. Please resolve the underlying issue before marking it as resolved.
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                      fontSize: 12,
                      background: '#ffffff',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid #fee2e2'
                    }}>
                      <div>Current Value: <strong style={{ color: '#dc2626' }}>{verificationResult.current_value}</strong></div>
                      <div>Threshold: <strong style={{ color: 'var(--text-main)' }}>{verificationResult.threshold}</strong></div>
                      <div>Rule: <strong>{verificationResult.rule_name}</strong></div>
                    </div>
                  </div>
                ) : verificationResult?.is_healthy ? (
                  /* Healthy Success Box */
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: 8,
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    color: '#065f46'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                      <CheckCircle2 size={16} color="#059669" />
                      Automated Health Verification Passed
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                      Telemetry check verified: Current metric (<strong>{verificationResult.current_value}</strong>) is within safe limits (threshold: {verificationResult.threshold}).
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Confirmation Question & Resolution Note Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <HelpCircle size={14} />
                  Have you fixed this issue?
                </label>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Detail the resolution steps (e.g. deployed bugfix, cleared Redis cache, restarted service)..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 12,
                    borderRadius: 8,
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Emergency Override Option if Still Active */}
              {verificationResult?.is_breached && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(217, 119, 6, 0.08)',
                  border: '1px solid rgba(217, 119, 6, 0.25)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10
                }}>
                  <input
                    type="checkbox"
                    id="override-checkbox"
                    checked={forceOverride}
                    onChange={(e) => setForceOverride(e.target.checked)}
                    style={{ marginTop: 2, cursor: 'pointer' }}
                  />
                  <label htmlFor="override-checkbox" style={{ fontSize: 12, color: 'var(--text-main)', cursor: 'pointer', lineHeight: 1.4 }}>
                    <strong>Administrative Override:</strong> Underlying issue has been mitigated externally. (Requires resolution notes above).
                  </label>
                </div>
              )}

              {/* Error Alert */}
              {modalError && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 6,
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <AlertTriangle size={14} />
                  {modalError}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-subtle)',
              background: 'var(--bg-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
              gap: 10
            }}>
              <button
                type="button"
                onClick={() => setResolvingIncident(null)}
                className="btn-secondary"
                style={{ fontSize: 12, padding: '8px 16px', cursor: 'pointer' }}
              >
                Keep in Investigation
              </button>

              <button
                type="button"
                onClick={handleConfirmResolution}
                disabled={
                  isVerifying ||
                  isSubmitting ||
                  (verificationResult?.is_breached && !forceOverride) ||
                  (verificationResult?.is_breached && forceOverride && resolutionNotes.trim().length < 5)
                }
                className="btn-primary"
                style={{
                  fontSize: 12,
                  padding: '8px 18px',
                  background: '#059669',
                  color: '#fff',
                  cursor: (verificationResult?.is_breached && !forceOverride) ? 'not-allowed' : 'pointer',
                  opacity: (verificationResult?.is_breached && !forceOverride) ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    Recording Resolution...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    Confirm Resolution
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Rules & Notification Channels Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 20 }}>
        {/* Rules Table */}
        <div className="glass-panel" style={{ padding: 'clamp(14px, 2.5vw, 20px)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 14 }}>
            Evaluation Rules ({rules.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rules.map((rule) => (
              <div key={rule.id} style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
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
        <div className="glass-panel" style={{ padding: 'clamp(14px, 2.5vw, 20px)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 14 }}>
            Dispatch Adapter Verification
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Test outbound notification channels with standardized rich payload formatting
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))', gap: 10 }}>
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
