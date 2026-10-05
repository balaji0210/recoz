import React from 'react';
import {
  Activity, Globe, AlertOctagon, GitMerge, Cpu, Bell, Settings,
  Shield, CheckCircle2, Sparkles
} from 'lucide-react';
import { Application } from '../types';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  applications: Application[];
  selectedAppId: string;
  setSelectedAppId: (id: string) => void;
  incidentCount?: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  applications,
  selectedAppId,
  setSelectedAppId,
  incidentCount = 1,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const navItems = [
    { id: 'landing', label: 'Product Landing', icon: Sparkles },
    { id: 'overview', label: 'APM Dashboard', icon: Activity },
    { id: 'rum', label: 'Real User Monitoring', icon: Globe },
    { id: 'errors', label: 'Error Diagnostics', icon: AlertOctagon },
    { id: 'traces', label: 'Traces & Waterfall', icon: GitMerge },
    { id: 'synthetics', label: 'Synthetic Monitoring', icon: Cpu },
    { id: 'alerts', label: 'Alerts & Incidents', icon: Bell, badge: incidentCount > 0 ? incidentCount : undefined },
    { id: 'settings', label: 'Settings & Ingest', icon: Settings }
  ];

  const handleSelectTab = (tabId: string) => {
    setCurrentTab(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const sidebarContent = (
    <aside
      className={isMobileOpen ? 'sidebar-drawer' : 'hide-on-tablet'}
      style={{
        width: 260,
        minWidth: 260,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: isMobileOpen ? 'fixed' : 'sticky',
        top: 0,
        zIndex: isMobileOpen ? 100 : 40,
        overscrollBehavior: 'contain',
        boxShadow: isMobileOpen ? '4px 0 24px rgba(0, 0, 0, 0.3)' : '1px 0 3px rgba(0, 0, 0, 0.02)'
      }}
    >
      {/* Brand Logo & Mobile Close */}
      <div 
        style={{
          padding: '20px 20px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)'
        }}
      >
        <div
          onClick={() => handleSelectTab('landing')}
          title="View Product Landing Page"
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
        >
          <div className="logo-box" style={{ width: 38, height: 38, fontSize: 17 }}>
            <span>R</span>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--text-main)', lineHeight: 1.1 }}>
              Ricoz<span style={{ color: 'var(--primary)' }}>AppMon</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
              Enterprise Observability
            </div>
          </div>
        </div>

        {isMobileOpen && onCloseMobile && (
          <button
            onClick={onCloseMobile}
            aria-label="Close Navigation Menu"
            style={{
              background: 'var(--bg-card-hover)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: 6,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* App Switcher */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
          Monitored Application
        </label>
        <div style={{ position: 'relative' }}>
          <select
            value={selectedAppId}
            onChange={(e) => setSelectedAppId(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '8px 10px',
              color: 'var(--text-main)',
              fontSize: 13,
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {applications.map((app) => (
              <option key={app.id} value={app.id} style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)' }}>
                {app.name} ({app.tier})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav style={{ flex: 1, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', fontWeight: 700, padding: '0 8px 6px' }}>
          Observability Hub
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelectTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 8,
                border: isActive ? '1px solid var(--primary)' : '1px solid transparent',
                background: isActive ? 'rgba(107, 26, 26, 0.08)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--bg-card-hover)';
                  e.currentTarget.style.color = 'var(--text-main)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon size={18} color={isActive ? 'var(--primary)' : 'var(--text-muted)'} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span style={{
                  background: '#e11d48',
                  color: '#ffffff',
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: 10,
                  minWidth: 18,
                  textAlign: 'center'
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info / Status Card */}
      <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>Collector Healthy</span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>v1.0.0</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Ingesting RUM, Traces & Errors
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-label="Close navigation overlay"
        />
      )}
      {sidebarContent}
    </>
  );
};

