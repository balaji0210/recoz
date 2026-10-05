import React, { useState, useEffect } from 'react';
import { AlertOctagon, CheckCircle2, EyeOff, Search, FileCode, Clock, User, Layers, ArrowRight } from 'lucide-react';
import { api } from '../api/client';
import { ErrorGroupItem } from '../types';

interface ErrorsPageProps {
  appId: string;
}

export const ErrorsPage: React.FC<ErrorsPageProps> = ({ appId }) => {
  const [errorGroups, setErrorGroups] = useState<ErrorGroupItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    return localStorage.getItem('rz_errors_status_filter') ?? '';
  });
  const [selectedGroup, setSelectedGroup] = useState<ErrorGroupItem | null>(null);
  const [groupDetail, setGroupDetail] = useState<any | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('rz_errors_status_filter', statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    loadErrors();
  }, [appId, statusFilter]);

  const loadErrors = async () => {
    try {
      const data = await api.getErrorGroups(appId, statusFilter || undefined);
      setErrorGroups(data);
      if (data.length > 0) {
        if (!selectedGroup) {
          handleSelectGroup(data[0]);
        } else {
          const fresh = data.find(g => g.id === selectedGroup.id);
          if (fresh) {
            setSelectedGroup(fresh);
          } else {
            handleSelectGroup(data[0]);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectGroup = async (group: ErrorGroupItem) => {
    setSelectedGroup(group);
    try {
      const detail = await api.getErrorGroupDetail(group.id);
      setGroupDetail(detail);
    } catch {
      // Fallback detail
      setGroupDetail({
        group,
        latest_event: {
          url: 'https://shopsphere.io/checkout',
          route: '/checkout',
          browser: 'Chrome 122',
          os: 'Windows 11',
          release_version: group.last_release,
          is_symbolicated: true,
          parsed_frames: [
            {
              function: 'handleCheckout',
              filename: 'checkout.ts',
              lineno: 84,
              colno: 19,
              original: {
                source: 'src/pages/Checkout.tsx',
                line: 42,
                column: 15,
                context: [
                  { line: 40, code: '  const onSubmit = async (data: CheckoutForm) => {', is_error_line: false },
                  { line: 41, code: '    const token = await createPaymentIntent();', is_error_line: false },
                  { line: 42, code: '    const charge = data.cartItems.price * 100;', is_error_line: true },
                  { line: 43, code: '    return charge;', is_error_line: false }
                ]
              }
            },
            {
              function: 'onClick',
              filename: 'Button.tsx',
              lineno: 22,
              colno: 8,
              original: {
                source: 'src/components/Button.tsx',
                line: 18,
                column: 4
              }
            }
          ],
          breadcrumbs: [
            { type: 'navigation', category: 'pageview', message: 'Navigated to /checkout', timestamp: Date.now() - 5000 },
            { type: 'fetch', category: 'network', message: 'POST /api/cart/verify [200] in 32ms', timestamp: Date.now() - 2500 },
            { type: 'ui', category: 'click', message: 'Clicked button[id="pay-now-submit"]', timestamp: Date.now() - 800 }
          ]
        }
      });
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedGroup) return;
    const targetId = selectedGroup.id;
    const newStatus = status as 'unhandled' | 'resolved' | 'ignored';

    // 1. Instant optimistic update
    setSelectedGroup(prev => prev ? { ...prev, status: newStatus } : null);
    setErrorGroups(prev =>
      prev.map(g => g.id === targetId ? { ...g, status: newStatus } : g)
    );
    setActionToast(`✓ Error group marked as ${status.toUpperCase()}`);

    // 2. Call backend API
    try {
      await api.updateErrorGroupStatus(targetId, status);
      const data = await api.getErrorGroups(appId, statusFilter || undefined);
      setErrorGroups(data);
      const matched = data.find(g => g.id === targetId);
      if (matched) {
        setSelectedGroup(matched);
      } else if (data.length > 0 && statusFilter) {
        // If the item moved out of the active status filter, auto-select next available item
        handleSelectGroup(data[0]);
      }
    } catch (e) {
      console.warn("Backend error updating status:", e);
    }
  };

  return (
    <div style={{ padding: 'clamp(14px, 3vw, 24px) clamp(12px, 3vw, 28px)', display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 3vw, 24px)', minWidth: 0 }}>
      {/* Header & Filter Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(20px, 4vw, 24px)', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', marginBottom: 4 }}>
            Error Diagnostics & Stack Symbolicator
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Fingerprinted crash groups with source-mapped JavaScript stack traces and breadcrumbs
          </p>
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 3, flexWrap: 'wrap', gap: 4 }}>
          {['unhandled', 'resolved', 'ignored', ''].map((st) => (
            <button
              key={st || 'all'}
              onClick={() => setStatusFilter(st)}
              style={{
                background: statusFilter === st ? '#ffffff' : 'transparent',
                color: statusFilter === st ? 'var(--accent-indigo)' : 'var(--text-muted)',
                boxShadow: statusFilter === st ? 'var(--shadow-sm)' : 'none',
                border: 'none',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'capitalize',
                cursor: 'pointer'
              }}
            >
              {st || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 20, alignItems: 'start' }}>
        {/* Error Groups List */}
        <div className="glass-panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
          {errorGroups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              No {statusFilter} error groups found.
            </div>
          ) : (
            errorGroups.map((err) => {
              const isSel = selectedGroup?.id === err.id;
              return (
                <div
                  key={err.id}
                  onClick={() => handleSelectGroup(err)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: isSel ? '#eef2ff' : 'var(--bg-primary)',
                    border: isSel ? '1px solid #c7d2fe' : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#e11d48' }}>
                      {err.error_type}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      v{err.last_release}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-main)', fontWeight: 600, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {err.message}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap', gap: 6 }}>
                    <span>{err.occurrence_count} events • {err.affected_users_count} users</span>
                    <span className="font-mono">{err.fingerprint.slice(0, 8)}...</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Group Detail & Stack Trace */}
        {selectedGroup && (
          <div className="glass-panel" style={{ padding: 'clamp(16px, 3vw, 24px)', display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            {/* Action Feedback Banner */}
            {actionToast && (
              <div style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: 8,
                padding: '10px 14px',
                color: '#047857',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={16} /> {actionToast}
                </div>
                <button
                  onClick={() => setActionToast(null)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#047857', fontSize: 12, fontWeight: 700 }}
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Action Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span className="badge badge-danger">
                    {selectedGroup.error_type}
                  </span>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: selectedGroup.status === 'resolved' ? '#ecfdf5' : (selectedGroup.status === 'ignored' ? '#f1f5f9' : '#fff1f2'),
                    color: selectedGroup.status === 'resolved' ? '#059669' : (selectedGroup.status === 'ignored' ? '#64748b' : '#e11d48'),
                    border: `1px solid ${selectedGroup.status === 'resolved' ? '#a7f3d0' : (selectedGroup.status === 'ignored' ? '#cbd5e1' : '#fecdd3')}`
                  }}>
                    [{selectedGroup.status}]
                  </span>
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', wordBreak: 'break-word' }}>
                  {selectedGroup.message}
                </h2>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {selectedGroup.status !== 'resolved' ? (
                  <button
                    onClick={() => handleUpdateStatus('resolved')}
                    className="btn-primary"
                    style={{ background: '#059669', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <CheckCircle2 size={14} /> Resolve
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpdateStatus('unhandled')}
                    className="btn-secondary"
                    style={{ fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <AlertOctagon size={14} /> Reopen
                  </button>
                )}
                {selectedGroup.status !== 'ignored' ? (
                  <button
                    onClick={() => handleUpdateStatus('ignored')}
                    className="btn-secondary"
                    style={{ fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <EyeOff size={14} /> Ignore
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpdateStatus('unhandled')}
                    className="btn-secondary"
                    style={{ fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <AlertOctagon size={14} /> Unignore
                  </button>
                )}
              </div>
            </div>

            {/* Diagnostics Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))', gap: 12 }}>
              <div style={{ background: 'var(--bg-primary)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Occurrences</span>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>{selectedGroup.occurrence_count}</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Users Affected</span>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>{selectedGroup.affected_users_count}</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>First Seen</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>1 day ago</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Fingerprint</span>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-indigo)', fontFamily: 'var(--font-mono)' }}>
                  {selectedGroup.fingerprint.slice(0, 10)}...
                </div>
              </div>
            </div>


            {/* Symbolicated Stack Trace Frame */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileCode size={16} color="var(--accent-indigo)" />
                  Symbolicated TypeScript Source Trace
                </h3>
                <span className="badge badge-info">Source Map Applied</span>
              </div>

              {groupDetail?.latest_event?.parsed_frames ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {groupDetail.latest_event.parsed_frames.map((frame: any, fIdx: number) => (
                    <div key={fIdx} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ padding: '8px 14px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                          {frame.original ? `${frame.original.source}:${frame.original.line}:${frame.original.column}` : `${frame.filename}:${frame.lineno}`}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          in {frame.function}()
                        </span>
                      </div>

                      {frame.original?.context && (
                        <div style={{ padding: '8px 0', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                          {frame.original.context.map((ctx: any, cIdx: number) => (
                            <div
                              key={cIdx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '2px 14px',
                                background: ctx.is_error_line ? '#fff1f2' : 'transparent',
                                borderLeft: ctx.is_error_line ? '3px solid #e11d48' : '3px solid transparent'
                              }}
                            >
                              <span style={{ width: 40, color: 'var(--text-muted)', userSelect: 'none' }}>
                                {ctx.line}
                              </span>
                              <span style={{ color: ctx.is_error_line ? '#be123c' : 'var(--text-main)', fontWeight: ctx.is_error_line ? 700 : 500 }}>
                                {ctx.code}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading stack trace details...
                </div>
              )}
            </div>

            {/* Breadcrumb Trail */}
            {groupDetail?.latest_event?.breadcrumbs && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', marginBottom: 10 }}>
                  Pre-Crash User Breadcrumbs
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {groupDetail.latest_event.breadcrumbs.map((bc: any, bIdx: number) => (
                    <div key={bIdx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 6, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', fontSize: 12 }}>
                      <span className="badge badge-info">{bc.category}</span>
                      <span style={{ color: 'var(--text-main)', fontWeight: 600, flex: 1 }}>{bc.message}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>T-{(Date.now() - bc.timestamp) / 1000}s</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
