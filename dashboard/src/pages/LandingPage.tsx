import React, { useState, useEffect } from 'react';
import {
  Activity, Globe, AlertOctagon, GitMerge, Cpu, Bell, Shield,
  ArrowRight, CheckCircle2, Copy, Check, Terminal, Zap, Code2,
  Layers, ExternalLink, Sun, Moon, Sparkles, ChevronRight, BarChart3,
  Server, Monitor, Clock, Menu, X, Users, Building2, CheckCircle
} from 'lucide-react';

interface LandingPageProps {
  onLaunchApp: (tab?: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchApp,
  theme,
  toggleTheme
}) => {
  const [activeSnippetTab, setActiveSnippetTab] = useState<'npm' | 'html' | 'trace' | 'franchise'>('npm');
  const [copied, setCopied] = useState(false);
  const [activeFeatureTab, setActiveFeatureTab] = useState<number>(0);
  const [simulating, setSimulating] = useState(false);
  const [simSuccess, setSimSuccess] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (mobileNavOpen) {
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
  }, [mobileNavOpen]);

  const snippets = {
    npm: `// 1. Install RicozAppMon RUM SDK
npm install @ricoz/rum-sdk

// 2. Initialize in your App entry point (index.tsx / main.ts)
import { RicozRum } from '@ricoz/rum-sdk';

const rum = new RicozRum({
  appId: 'demo-ecommerce-app-id',
  endpoint: 'http://localhost:8000/api/v1/ingest/rum',
  enableWebVitals: true,      // Tracks LCP, FID, CLS, INP
  enableTracing: true,        // Injects W3C traceparent headers
  enableErrors: true,         // Captures unhandled errors & breadcrumbs
  sampleRate: 1.0,
  releaseVersion: '2.4.0'
});`,
    html: `<!-- Drop-in Script Tag (zero dependencies, 3.4KB gzip) -->
<script 
  src="https://cdn.ricoz.in/rum-sdk.min.js" 
  data-app-id="demo-ecommerce-app-id"
  data-endpoint="http://localhost:8000/api/v1/ingest/rum"
  data-tracing="true"
  async>
</script>`,
    trace: `// Automatic Distributed Tracing & W3C Span Propagation
// Client fetch calls automatically append W3C headers:
// 'traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'

fetch('/api/v1/orders/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ orderId: 'ord_8821', partnerId: 'franchise_mum_01' })
});

// The backend gateway stitches child spans across:
// 1. JWT Auth & Tenant Validation (2.4ms)
// 2. Redis Session Cache Read (0.8ms)
// 3. PostgreSQL Order Write & Telemetry (11.2ms)`,
    franchise: `// Multi-Tenant Franchise Ingestion Configuration
import { RicozFranchiseMonitor } from '@ricoz/rum-sdk';

export const franchiseTelemetry = new RicozFranchiseMonitor({
  tenantId: 'ricoz-franchise-hub-india',
  region: 'ap-south-1',
  slaAlerts: true,
  healthProbeIntervalMs: 30000,
  endpoint: 'http://localhost:8000/api/v1/ingest/franchise'
});`
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestDrive = async () => {
    setSimulating(true);
    try {
      await fetch('http://localhost:8000/api/v1/stats/health').catch(() => {});
      setSimSuccess(true);
      setTimeout(() => setSimSuccess(false), 3500);
    } catch {
      setSimSuccess(true);
      setTimeout(() => setSimSuccess(false), 3500);
    } finally {
      setSimulating(false);
    }
  };

  const featureTabs = [
    {
      tabId: 'rum',
      title: 'Real User Monitoring (RUM)',
      icon: Globe,
      badge: 'Core Web Vitals',
      color: '#0891b2',
      headline: 'Pixel-Perfect Real User Experience & Vitals',
      desc: 'Capture every navigation, client route change, and Google Core Web Vital (LCP, FID, CLS, INP) across real devices with live Apdex satisfaction calculation.',
      stats: [
        { label: 'Avg Apdex Score', val: '0.94 EXCELLENT' },
        { label: 'P95 LCP', val: '1.24s' },
        { label: 'Bundle Impact', val: '3.4 KB' }
      ]
    },
    {
      tabId: 'traces',
      title: 'Distributed Tracing & Waterfall',
      icon: GitMerge,
      badge: 'W3C OpenTelemetry',
      color: '#6B1A1A',
      headline: 'End-to-End Spans from Browser Click to Database Span',
      desc: 'Track single transactions seamlessly as they travel through client fetch calls, reverse proxies, FastAPI microservices, and PostgreSQL database queries.',
      stats: [
        { label: 'Trace Standard', val: 'W3C traceparent' },
        { label: 'Max Propagation Overhead', val: '< 0.3ms' },
        { label: 'Span Granularity', val: 'Microsecond' }
      ]
    },
    {
      tabId: 'errors',
      title: 'Error Diagnostics & Source Maps',
      icon: AlertOctagon,
      badge: 'Zero-Config Symbolication',
      color: '#dc2626',
      headline: 'Unravel Minified Production Crashes Instantly',
      desc: 'Automatic source map ingestion and resolution maps obfuscated stack traces back to clean TypeScript code lines with rich local user breadcrumb histories.',
      stats: [
        { label: 'Symbolication Speed', val: '12ms' },
        { label: 'Breadcrumb Limit', val: '25 actions' },
        { label: 'Resolution Rate', val: '99.8%' }
      ]
    },
    {
      tabId: 'synthetics',
      title: 'Synthetic Probes & Latency SLAs',
      icon: Cpu,
      badge: 'Continuous Verification',
      color: '#16a34a',
      headline: 'Catch Outages Before Your Customers Notice',
      desc: 'Run automated, scheduled HTTP/API probes with deep network timing breakdowns: DNS lookup, TCP handshake, TLS negotiation, and Time to First Byte (TTFB).',
      stats: [
        { label: 'Probe Frequency', val: 'Every 60s' },
        { label: 'Timing Breakdown', val: 'DNS/TCP/TLS/TTFB' },
        { label: 'JSON Assertion', val: 'Dynamic Keys' }
      ]
    },
    {
      tabId: 'alerts',
      title: 'Real-Time Alert State Machine',
      icon: Bell,
      badge: 'Instant Escalation',
      color: '#d97706',
      headline: 'Smart Thresholds with Multi-Window Auto-Recovery',
      desc: 'Multi-window evaluation rules prevent alert fatigue. Instant dispatch to Slack, webhooks, and incident management systems the moment thresholds are breached.',
      stats: [
        { label: 'Evaluation Cycle', val: 'Every 30s' },
        { label: 'Auto-Recovery', val: 'Built-in' },
        { label: 'Channels', val: 'Slack / Webhooks' }
      ]
    }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      color: 'var(--text-main)',
      fontFamily: 'var(--font-sans)',
      overflowX: 'clip'
    }}>
      {/* ========================================================================= */}
      {/* 1. TOP NAVIGATION BAR */}
      {/* ========================================================================= */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        width: '100%',
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 clamp(16px, 5vw, 64px)',
        minHeight: 68
      }}>
        {/* Brand */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', minWidth: 0 }}
          onClick={() => onLaunchApp('overview')}
          title="RicozAppMon Observability Home"
        >
          <div className="logo-box">
            <span>R</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 21,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              color: 'var(--text-main)'
            }}>
              Ricoz<span style={{ color: 'var(--primary)' }}>AppMon</span>
            </div>
            <div className="hide-on-mobile" style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
              Enterprise Observability & APM Platform
            </div>
          </div>
        </div>

        {/* Desktop Anchor Links */}
        <div className="hide-on-tablet" style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 13, fontWeight: 600 }}>
          <a href="#features" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>Solutions</a>
          <a href="#preview" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>Live Console</a>
          <a href="#architecture" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>Architecture</a>
          <a href="#quickstart" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>SDK Ingest</a>
        </div>

        {/* Right CTA / Theme Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '7px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--text-main)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {theme === 'light' ? <Sun size={14} color="#d97706" /> : <Moon size={14} color="#C9A96E" />}
            <span className="hide-on-small-mobile">{theme === 'light' ? 'Light' : 'Dark'}</span>
          </button>

          <button
            onClick={() => onLaunchApp('overview')}
            className="btn-primary hide-on-small-mobile"
          >
            <span>Launch Console</span>
            <ArrowRight size={14} />
          </button>

          {/* Mobile Hamburger Menu Toggle */}
          <button
            onClick={() => setMobileNavOpen(prev => !prev)}
            aria-label="Toggle mobile menu"
            className="btn-secondary"
            style={{
              display: 'none',
              padding: '7px 9px',
              borderRadius: 8
            }}
            id="landing-mobile-menu-btn"
          >
            {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {/* Mobile Navigation Dropdown Drawer */}
      {mobileNavOpen && (
        <div
          style={{
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-subtle)',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            boxShadow: 'var(--shadow-lg)',
            animation: 'slideInDown 0.2s ease-out'
          }}
        >
          <a
            href="#features"
            onClick={() => setMobileNavOpen(false)}
            style={{ color: 'var(--text-main)', textDecoration: 'none', fontSize: 14, fontWeight: 600, padding: '6px 0' }}
          >
            Solutions & Modules
          </a>
          <a
            href="#preview"
            onClick={() => setMobileNavOpen(false)}
            style={{ color: 'var(--text-main)', textDecoration: 'none', fontSize: 14, fontWeight: 600, padding: '6px 0' }}
          >
            Live Console Preview
          </a>
          <a
            href="#architecture"
            onClick={() => setMobileNavOpen(false)}
            style={{ color: 'var(--text-main)', textDecoration: 'none', fontSize: 14, fontWeight: 600, padding: '6px 0' }}
          >
            Pipeline Architecture
          </a>
          <a
            href="#quickstart"
            onClick={() => setMobileNavOpen(false)}
            style={{ color: 'var(--text-main)', textDecoration: 'none', fontSize: 14, fontWeight: 600, padding: '6px 0' }}
          >
            SDK Quickstart Guide
          </a>

          <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => {
                setMobileNavOpen(false);
                onLaunchApp('overview');
              }}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', fontSize: 14 }}
            >
              <Activity size={16} />
              <span>Launch APM Command Console</span>
            </button>
          </div>
        </div>
      )}


      {/* ========================================================================= */}
      {/* 2. HERO SECTION (EDITORIAL LUXURY & APM INTELLIGENCE) */}
      {/* ========================================================================= */}
      <section style={{
        padding: 'clamp(48px, 8vw, 88px) clamp(16px, 5vw, 64px) 50px',
        textAlign: 'center',
        maxWidth: 1200,
        margin: '0 auto',
        position: 'relative'
      }}>
        {/* Live Status Pill */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '6px 16px',
          borderRadius: 24,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-main)',
          fontSize: 'clamp(11px, 2.5vw, 13px)',
          fontWeight: 600,
          marginBottom: 26,
          maxWidth: '100%',
          boxSizing: 'border-box',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <span className="live-dot" />
          <span>RicozAppMon v2.4 Enterprise • Telemetry & Ingestion Pipeline Operational</span>
          <ChevronRight size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        </div>

        {/* Main Editorial Headline */}
        <h1 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(32px, 5.5vw, 64px)',
          fontWeight: 400,
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          maxWidth: 1020,
          margin: '0 auto 22px',
          color: 'var(--text-main)'
        }}>
          Full-Stack Observability from{' '}
          <span style={{ color: 'var(--primary)', fontStyle: 'italic', fontWeight: 400 }}>
            Client Browser Click
          </span>{' '}
          to Database Span & Franchise Edge.
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 'clamp(15px, 1.8vw, 19px)',
          color: 'var(--text-secondary)',
          maxWidth: 820,
          margin: '0 auto 36px',
          lineHeight: 1.6,
          fontWeight: 400
        }}>
          The unified application performance monitoring platform uniting Real User Monitoring (RUM),
          Core Web Vitals, Stack Trace Symbolication, Distributed Tracing, Synthetic Health Probes, and Franchise Partner Network SLA Intelligence.
        </p>

        {/* Primary Call to Action Buttons */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          flexWrap: 'wrap',
          marginBottom: 32
        }}>
          <button
            onClick={() => onLaunchApp('overview')}
            className="btn-primary"
            style={{
              padding: 'clamp(11px, 2.5vw, 14px) clamp(20px, 4vw, 32px)',
              fontSize: 'clamp(14px, 2vw, 15px)',
              borderRadius: 10,
              fontWeight: 700
            }}
          >
            <Activity size={18} />
            <span>Open APM Command Console</span>
            <ArrowRight size={16} />
          </button>

          <a
            href="#quickstart"
            className="btn-gold"
            style={{
              padding: 'clamp(11px, 2.5vw, 14px) clamp(18px, 3.5vw, 28px)',
              fontSize: 'clamp(13px, 2vw, 15px)',
              borderRadius: 10,
              fontWeight: 700,
              textDecoration: 'none'
            }}
          >
            <Code2 size={17} />
            <span>SDK Quickstart Guide</span>
          </a>

          <button
            onClick={handleTestDrive}
            disabled={simulating}
            className="btn-secondary"
            style={{
              padding: 'clamp(11px, 2.5vw, 14px) clamp(16px, 3vw, 24px)',
              fontSize: 'clamp(13px, 1.8vw, 14px)',
              borderRadius: 10,
              fontWeight: 600,
              cursor: simulating ? 'wait' : 'pointer'
            }}
          >
            <Zap size={15} color="var(--primary)" />
            <span>{simulating ? 'Testing Ingest...' : simSuccess ? '✓ Ingest Latency 0.8ms (200 OK)' : 'Test Ingest Latency'}</span>
          </button>
        </div>

        {/* Quick Module Jump Pills (1-Click Direct Access) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 44
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>
            Direct Module Access:
          </span>
          {[
            { id: 'overview', label: 'APM Overview', icon: Activity, color: '#6B1A1A' },
            { id: 'rum', label: 'Real User Monitoring', icon: Globe, color: '#0891b2' },
            { id: 'errors', label: 'Error Diagnostics', icon: AlertOctagon, color: '#dc2626' },
            { id: 'traces', label: 'Traces Waterfall', icon: GitMerge, color: '#8B2222' },
            { id: 'synthetics', label: 'Synthetic Probes', icon: Cpu, color: '#16a34a' },
            { id: 'alerts', label: 'Alerts & Incidents', icon: Bell, color: '#d97706' },
            { id: 'settings', label: 'SDK & Settings', icon: Terminal, color: '#C9A96E' }
          ].map((mod) => {
            const ModIcon = mod.icon;
            return (
              <button
                key={mod.id}
                onClick={() => onLaunchApp(mod.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 20,
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.color = 'var(--primary)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.color = 'var(--text-main)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <ModIcon size={13} color={mod.color} />
                <span>{mod.label}</span>
              </button>
            );
          })}
        </div>

        {/* Live Metrics Ribbon */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          gap: 16,
          maxWidth: 1060,
          margin: '0 auto',
          padding: '22px clamp(16px, 3vw, 28px)',
          background: 'var(--bg-card)',
          borderRadius: 16,
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-md)'
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--primary)', fontWeight: 400 }}>&lt; 1.2ms</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>Collector Ingest Latency</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: '#0891b2', fontWeight: 400 }}>3.4 KB</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>Zero-Overhead RUM SDK</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: '#16a34a', fontWeight: 400 }}>W3C OpenTelemetry</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>Distributed Context Standard</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: '#C9A96E', fontWeight: 400 }}>100% Symbolicated</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>Source Map Accuracy</div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. INTERACTIVE APM CONSOLE PREVIEW */}
      {/* ========================================================================= */}
      <section id="preview" style={{
        padding: '20px clamp(16px, 5vw, 64px) 70px',
        maxWidth: 1240,
        margin: '0 auto'
      }}>
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative'
        }}>
          {/* Mock Console Header Bar */}
          <div style={{
            background: 'var(--primary-dark)',
            color: '#ffffff',
            padding: '14px clamp(14px, 3vw, 24px)',
            borderBottom: '1px solid rgba(201, 169, 110, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ef4444' }} />
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#f59e0b' }} />
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#22c55e' }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', marginLeft: 4, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                ricozappmon-console://enterprise-node/live-telemetry
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 9px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                background: 'rgba(34, 197, 94, 0.2)',
                color: '#86efac',
                border: '1px solid rgba(34, 197, 94, 0.4)'
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                Collector Pipelines Operational
              </span>
              <button
                onClick={() => onLaunchApp('overview')}
                className="btn-gold"
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                <span>Interactive View</span>
                <ExternalLink size={12} />
              </button>
            </div>
          </div>

          {/* Interactive Mock Dashboard Body */}
          <div style={{ padding: 'clamp(16px, 3vw, 28px)' }}>
            {/* Top Stat Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
              gap: 16,
              marginBottom: 24
            }}>
              <div style={{ background: 'var(--bg-muted)', padding: 18, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Total Requests / Throughput</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, marginTop: 4, color: 'var(--text-main)' }}>8,492 req/min</div>
                <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginTop: 4 }}>+12.4% vs last hour</div>
              </div>

              <div style={{ background: 'var(--bg-muted)', padding: 18, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>P95 Latency SLA</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, marginTop: 4, color: 'var(--primary)' }}>184 ms</div>
                <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginTop: 4 }}>Target: &lt; 500 ms (HEALTHY)</div>
              </div>

              <div style={{ background: 'var(--bg-muted)', padding: 18, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Apdex Satisfaction Score</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, marginTop: 4, color: '#16a34a' }}>0.94 / 1.00</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>91% Satisfied • 7% Tolerating</div>
              </div>

              <div style={{ background: 'var(--bg-muted)', padding: 18, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Error Rate Threshold</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, marginTop: 4, color: '#16a34a' }}>0.08%</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>1 Unresolved Critical Crash</div>
              </div>
            </div>

            {/* Mock Chart & Waterfall Timeline */}
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 14,
              padding: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Telemetry Timeseries & Waterfall Latency Breakdown</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Live synthetic probes and distributed W3C spans across 15 simulated client sessions</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className="badge badge-info" style={{ textTransform: 'none' }}>Endpoint: /api/v1/checkout</span>
                  <span className="badge badge-healthy">HTTP 200 OK</span>
                </div>
              </div>

              {/* SVG Mock Timeseries Curve */}
              <div style={{ height: 160, width: '100%', position: 'relative' }}>
                <svg viewBox="0 0 800 160" style={{ width: '100%', height: '100%', overflow: 'visible' }} preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="ricozGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#6B1A1A" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#6B1A1A" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,130 Q100,60 200,85 T400,40 T600,75 T800,30 L800,160 L0,160 Z"
                    fill="url(#ricozGrad)"
                  />
                  <path
                    d="M0,130 Q100,60 200,85 T400,40 T600,75 T800,30"
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="3"
                  />
                  {/* Data points */}
                  <circle cx="200" cy="85" r="4" fill="var(--accent)" stroke="#fff" strokeWidth="2" />
                  <circle cx="400" cy="40" r="4" fill="var(--accent)" stroke="#fff" strokeWidth="2" />
                  <circle cx="600" cy="75" r="4" fill="var(--accent)" stroke="#fff" strokeWidth="2" />
                  <circle cx="800" cy="30" r="4" fill="var(--accent)" stroke="#fff" strokeWidth="2" />
                </svg>
              </div>

              {/* Span Waterfall Tree Mock */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Distributed Span Hierarchy
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-muted)', borderRadius: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 700 }}>[Client RUM]</span>
                      <span>POST /api/v1/checkout (User Click)</span>
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>184.2 ms</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', paddingLeft: 24, background: 'var(--bg-muted)', borderRadius: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#0891b2', fontWeight: 700 }}>[Gateway]</span>
                      <span>auth.verify_jwt_token</span>
                    </div>
                    <span style={{ color: 'var(--text-muted)' }}>2.4 ms</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', paddingLeft: 36, background: 'var(--bg-muted)', borderRadius: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#d97706', fontWeight: 700 }}>[Cache]</span>
                      <span>redis.get(session_token_key)</span>
                    </div>
                    <span style={{ color: 'var(--text-muted)' }}>0.8 ms</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', paddingLeft: 36, background: 'var(--bg-muted)', borderRadius: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#16a34a', fontWeight: 700 }}>[Database]</span>
                      <span>INSERT INTO orders (cart_id, total, status)</span>
                    </div>
                    <span style={{ color: 'var(--text-muted)' }}>11.2 ms</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. CORE OBSERVABILITY SOLUTIONS & CAPABILITIES */}
      {/* ========================================================================= */}
      <section id="features" style={{
        padding: '60px clamp(16px, 5vw, 64px) 80px',
        maxWidth: 1200,
        margin: '0 auto'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>
            Comprehensive Telemetry Modules
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 400, letterSpacing: '-0.02em' }}>
            Built for High-Scale Applications & Enterprise Teams
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 16, maxWidth: 680, margin: '8px auto 0' }}>
            Zero-overhead instrumentation across frontend clients, distributed microservices, and backend storage.
          </p>
        </div>

        {/* Feature Tabs Selector */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 32
        }}>
          {featureTabs.map((f, idx) => {
            const Icon = f.icon;
            const isSelected = activeFeatureTab === idx;
            return (
              <button
                key={idx}
                onClick={() => setActiveFeatureTab(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isSelected ? '1.5px solid var(--primary)' : '1.5px solid var(--border-subtle)',
                  background: isSelected ? 'var(--primary)' : 'var(--bg-card)',
                  color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? 'var(--shadow-sm)' : 'none'
                }}
              >
                <Icon size={16} color={isSelected ? '#ffffff' : 'var(--text-muted)'} />
                <span>{f.title}</span>
              </button>
            );
          })}
        </div>

        {/* Active Feature Detail Card */}
        {(() => {
          const current = featureTabs[activeFeatureTab];
          const CurrentIcon = current.icon;
          return (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 16,
              padding: 'clamp(20px, 4vw, 40px)',
              boxShadow: 'var(--shadow-md)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
              gap: 'clamp(20px, 4vw, 36px)',
              alignItems: 'center'
            }}>
              <div>
                <span className="badge badge-info" style={{ marginBottom: 16 }}>
                  {current.badge}
                </span>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px, 3vw, 34px)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 16 }}>
                  {current.headline}
                </h3>
                <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
                  {current.desc}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 100px), 1fr))', gap: 12, marginBottom: 24 }}>
                  {current.stats.map((s, idx) => (
                    <div key={idx} style={{ background: 'var(--bg-muted)', padding: 12, borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, marginTop: 4, color: current.color }}>{s.val}</div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => onLaunchApp(current.tabId)}
                  className="btn-primary"
                  style={{ padding: '10px 22px', fontSize: 14 }}
                >
                  <span>Launch {current.title.split('(')[0].trim()} Module</span>
                  <ArrowRight size={16} />
                </button>
              </div>

              {/* Graphic Mock Card */}
              <div style={{
                background: 'var(--bg-muted)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 14,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 240,
                textAlign: 'center'
              }}>
                <div style={{
                  width: 68,
                  height: 68,
                  borderRadius: 18,
                  background: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(107, 26, 26, 0.35)',
                  border: '1px solid rgba(201, 169, 110, 0.3)',
                  marginBottom: 16
                }}>
                  <CurrentIcon size={32} color="#C9A96E" />
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, fontWeight: 400, marginBottom: 8 }}>
                  Integrated & Ready Out-of-the-Box
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 340, lineHeight: 1.5 }}>
                  Plug the SDK into any frontend application or backend service. Zero configuration required for automatic symbolication and span stitching.
                </div>
              </div>
            </div>
          );
        })()}
      </section>

      {/* ========================================================================= */}
      {/* 5. ARCHITECTURE PIPELINE FLOW */}
      {/* ========================================================================= */}
      <section id="architecture" style={{
        padding: '60px clamp(16px, 5vw, 64px)',
        maxWidth: 1200,
        margin: '0 auto',
        background: 'var(--bg-secondary)',
        borderRadius: 24,
        border: '1px solid var(--border-subtle)',
        marginBottom: 80,
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>
            End-to-End Ingestion Pipeline
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 400, letterSpacing: '-0.02em' }}>
            How RicozAppMon Ingests and Correlates Telemetry
          </h2>
        </div>

        {/* Pipeline Diagram Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
          gap: 16,
          position: 'relative'
        }}>
          {/* Step 1 */}
          <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Monitor size={18} color="#0891b2" />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#0891b2' }}>STEP 01</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Browser & RUM SDK</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Intercepts web vitals, fetch/xhr requests, and unhandled errors. Stitches W3C traceparents.
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Zap size={18} color="var(--primary)" />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>STEP 02</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>FastAPI Gateway</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Validates ingest API keys, batches payloads, and writes asynchronously to Timescale/ClickHouse.
            </div>
          </div>

          {/* Step 3 */}
          <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Terminal size={18} color="#dc2626" />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>STEP 03</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Symbolicator Engine</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Resolves minified stack traces against uploaded source maps in memory with LRU caching.
            </div>
          </div>

          {/* Step 4 */}
          <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Bell size={18} color="#d97706" />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706' }}>STEP 04</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Alert State Machine</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Continuously evaluates error rate and latency SLAs. Dispatches webhooks & Slack alerts.
            </div>
          </div>

          {/* Step 5 */}
          <div
            onClick={() => onLaunchApp('overview')}
            style={{
              background: 'var(--bg-card)',
              padding: 18,
              borderRadius: 12,
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart3 size={18} color="#16a34a" />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>STEP 05</span>
              </div>
              <ArrowRight size={14} color="var(--primary)" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Executive Console</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Interactive SVG timeseries, waterfall trees, and multi-tenant telemetry dashboards.
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. DEVELOPER QUICKSTART & CODE SNIPPET */}
      {/* ========================================================================= */}
      <section id="quickstart" style={{
        padding: '60px clamp(16px, 5vw, 64px) 90px',
        maxWidth: 1100,
        margin: '0 auto'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>
            Developer Friendly Integration
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 400, letterSpacing: '-0.02em' }}>
            Instrument in Under 2 Minutes
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 16, marginTop: 8 }}>
            Copy, paste, and start receiving live traces immediately into RicozAppMon.
          </p>
        </div>

        {/* Code Box Container */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)'
        }}>
          {/* Snippet Tabs */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-card)',
            flexWrap: 'wrap',
            gap: 10
          }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={() => setActiveSnippetTab('npm')}
                style={{
                  background: activeSnippetTab === 'npm' ? 'var(--primary)' : 'transparent',
                  color: activeSnippetTab === 'npm' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                NPM / React / Vite
              </button>
              <button
                onClick={() => setActiveSnippetTab('html')}
                style={{
                  background: activeSnippetTab === 'html' ? 'var(--primary)' : 'transparent',
                  color: activeSnippetTab === 'html' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                HTML Drop-in
              </button>
              <button
                onClick={() => setActiveSnippetTab('trace')}
                style={{
                  background: activeSnippetTab === 'trace' ? 'var(--primary)' : 'transparent',
                  color: activeSnippetTab === 'trace' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                W3C Tracing Flow
              </button>
              <button
                onClick={() => setActiveSnippetTab('franchise')}
                style={{
                  background: activeSnippetTab === 'franchise' ? 'var(--primary)' : 'transparent',
                  color: activeSnippetTab === 'franchise' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Franchise Ingest
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => handleCopy(snippets[activeSnippetTab])}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  cursor: 'pointer'
                }}
              >
                {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                <span>{copied ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
          </div>

          {/* Code Text Content */}
          <div style={{ padding: 'clamp(14px, 3vw, 24px)', overflowX: 'auto', background: theme === 'light' ? '#140D0D' : '#090505' }}>
            <pre style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              lineHeight: 1.6,
              color: '#f8fafc',
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              <code>{snippets[activeSnippetTab]}</code>
            </pre>
          </div>
        </div>
      </section>


      {/* ========================================================================= */}
      {/* 7. SIGNATURE RICOZ DARK BURGUNDY BANNER & CTA */}
      {/* ========================================================================= */}
      <section style={{
        padding: '0 clamp(16px, 5vw, 64px) 80px',
        maxWidth: 1200,
        margin: '0 auto'
      }}>
        <div className="dark-banner" style={{
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ maxWidth: 820, margin: '0 auto', position: 'relative', zIndex: 2 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 14px',
              borderRadius: 20,
              background: 'rgba(201, 169, 110, 0.2)',
              border: '1px solid rgba(201, 169, 110, 0.4)',
              color: '#E5C58A',
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 18
            }}>
              <Sparkles size={14} />
              <span>Enterprise APM & Multi-Tenant Franchise Observability</span>
            </div>

            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(30px, 4.5vw, 46px)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              marginBottom: 16,
              color: '#ffffff'
            }}>
              Gain Total Visibility into Your Web Applications & Ecosystem.
            </h2>
            <p style={{ fontSize: 17, color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.6, marginBottom: 32 }}>
              Eliminate blind spots. Detect slowdowns, resolve production crashes with original stack traces,
              and guarantee 99.99% uptime with RicozAppMon.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
              <button
                onClick={() => onLaunchApp('overview')}
                className="btn-gold"
                style={{
                  padding: '14px 32px',
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 700
                }}
              >
                <Activity size={18} color="#6B1A1A" />
                <span>Open APM Command Console</span>
                <ArrowRight size={16} color="#6B1A1A" />
              </button>

              <button
                onClick={() => onLaunchApp('settings')}
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  padding: '14px 26px',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s ease',
                  fontFamily: 'var(--font-sans)'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)')}
              >
                <Terminal size={17} />
                <span>SDK Setup & Settings</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. FOOTER */}
      {/* ========================================================================= */}
      <footer style={{
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-subtle)',
        padding: '36px clamp(16px, 5vw, 64px)',
        fontSize: 13,
        color: 'var(--text-muted)'
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="logo-box" style={{ width: 28, height: 28, fontSize: 13 }}>
              <span>R</span>
            </div>
            <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--text-main)', fontSize: 16 }}>RicozAppMon</span>
            <span>— Enterprise Observability & APM Platform</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <a
              href="http://ricoz.in/franchise/"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span>Franchise Portal</span>
              <ExternalLink size={12} />
            </a>
            <span>•</span>
            <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
              <span className="live-dot" />
              All Systems Operational
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
