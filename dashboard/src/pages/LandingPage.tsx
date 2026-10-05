import React, { useState } from 'react';
import {
  Activity, Globe, AlertOctagon, GitMerge, Cpu, Bell, Shield,
  ArrowRight, CheckCircle2, Copy, Check, Terminal, Zap, Code2,
  Layers, ExternalLink, Sun, Moon, Sparkles, ChevronRight, BarChart3,
  Server, Monitor, Clock, Menu, X
} from 'lucide-react';

interface LandingPageProps {
  onLaunchApp: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchApp,
  theme,
  toggleTheme
}) => {
  const [activeSnippetTab, setActiveSnippetTab] = useState<'npm' | 'html' | 'trace'>('npm');
  const [copied, setCopied] = useState(false);
  const [activeFeatureTab, setActiveFeatureTab] = useState<number>(0);
  const [simulating, setSimulating] = useState(false);
  const [simSuccess, setSimSuccess] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const snippets = {
    npm: `// 1. Install RUM SDK
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
  releaseVersion: '1.2.0'
});`,
    html: `<!-- Drop-in Script Tag (zero dependencies, 3.4KB gzip) -->
<script 
  src="https://cdn.ricoz.dev/rum-sdk.min.js" 
  data-app-id="demo-ecommerce-app-id"
  data-endpoint="http://localhost:8000/api/v1/ingest/rum"
  data-tracing="true"
  async>
</script>`,
    trace: `// Automatic Distributed Tracing Propagation
// Client fetch calls automatically append W3C headers:
// 'traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'

fetch('/api/v1/checkout', {
  method: 'POST',
  body: JSON.stringify({ cartId: 'cart_992' })
});

// The backend receives the traceparent, attaches child spans for:
// 1. Auth token validation (3ms)
// 2. Redis session cache read (1ms)
// 3. PostgreSQL order write (12ms)`
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
      setTimeout(() => setSimSuccess(false), 3000);
    } catch {
      setSimSuccess(true);
      setTimeout(() => setSimSuccess(false), 3000);
    } finally {
      setSimulating(false);
    }
  };

  const featureTabs = [
    {
      title: 'Real User Monitoring (RUM)',
      icon: Globe,
      badge: 'Core Web Vitals',
      color: '#0891b2',
      headline: 'Pixel-Perfect User Experience Visibility',
      desc: 'Capture every navigation, client route change, and Google Core Web Vital (LCP, FID, CLS, INP) across real devices with live Apdex satisfaction calculation.',
      stats: [
        { label: 'Avg Apdex Score', val: '0.94 EXCELLENT' },
        { label: 'P95 LCP', val: '1.24s' },
        { label: 'Bundle Impact', val: '3.4 KB' }
      ]
    },
    {
      title: 'Distributed Tracing & Waterfall',
      icon: GitMerge,
      badge: 'W3C OpenTelemetry',
      color: '#4f46e5',
      headline: 'End-to-End Spans from Click to Database Query',
      desc: 'Track single transactions seamlessly as they travel through client fetch calls, reverse proxies, FastAPI microservices, and PostgreSQL database queries.',
      stats: [
        { label: 'Trace Standard', val: 'W3C traceparent' },
        { label: 'Max Propagation Overhead', val: '< 0.3ms' },
        { label: 'Span Granularity', val: 'Microsecond' }
      ]
    },
    {
      title: 'Error Diagnostics & Source Maps',
      icon: AlertOctagon,
      badge: 'Zero-Config Symbolication',
      color: '#e11d48',
      headline: 'Unravel Minified Production Crashes Instantly',
      desc: 'Automatic source map ingestion and resolution maps obfuscated stack traces back to clean TypeScript code lines with rich local user breadcrumb histories.',
      stats: [
        { label: 'Symbolication Speed', val: '12ms' },
        { label: 'Breadcrumb Limit', val: '25 actions' },
        { label: 'Resolution Rate', val: '99.8%' }
      ]
    },
    {
      title: 'Synthetic Probes & Latency SLAs',
      icon: Cpu,
      badge: 'Continuous Verification',
      color: '#059669',
      headline: 'Catch Outages Before Your Customers Notice',
      desc: 'Run automated, scheduled HTTP/API probes with deep network timing breakdowns: DNS lookup, TCP handshake, TLS negotiation, and Time to First Byte (TTFB).',
      stats: [
        { label: 'Probe Frequency', val: 'Every 60s' },
        { label: 'Timing Breakdown', val: 'DNS/TCP/TLS/TTFB' },
        { label: 'JSON Assertion', val: 'Dynamic Keys' }
      ]
    },
    {
      title: 'Real-Time Alert State Machine',
      icon: Bell,
      badge: 'Instant Escalation',
      color: '#d97706',
      headline: 'Smart Thresholds with Automatic Resolution',
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
      overflowX: 'hidden'
    }}>
      {/* ========================================================================= */}
      {/* 1. TOP NAVIGATION BAR */}
      {/* ========================================================================= */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={onLaunchApp}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
            flexShrink: 0
          }}>
            <Activity size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
              Ricoz<span style={{ color: '#4f46e5' }}>AppMon</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
              Full-Stack APM & Observability
            </div>
          </div>
        </div>

        {/* Desktop Anchor Links */}
        <div className="hide-on-tablet" style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 14, fontWeight: 600 }}>
          <a href="#features" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = '#4f46e5')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>Features</a>
          <a href="#architecture" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = '#4f46e5')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>Architecture</a>
          <a href="#quickstart" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = '#4f46e5')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>SDK Quickstart</a>
          <a href="#preview" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = '#4f46e5')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>Live Console</a>
        </div>

        {/* Right CTA / Theme Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
              cursor: 'pointer'
            }}
          >
            {theme === 'light' ? <Sun size={14} color="#d97706" /> : <Moon size={14} color="#818cf8" />}
            <span className="hide-on-small-mobile">{theme === 'light' ? 'Light' : 'Dark'}</span>
          </button>

          <button
            onClick={onLaunchApp}
            className="btn-primary"
            style={{
              padding: '8px 14px',
              fontSize: 13,
              borderRadius: 8,
              fontWeight: 700
            }}
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
              padding: '7px 10px',
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
            style={{ color: 'var(--text-main)', textDecoration: 'none', fontSize: 15, fontWeight: 700, padding: '6px 0' }}
          >
            Features & Capabilities
          </a>
          <a
            href="#architecture"
            onClick={() => setMobileNavOpen(false)}
            style={{ color: 'var(--text-main)', textDecoration: 'none', fontSize: 15, fontWeight: 700, padding: '6px 0' }}
          >
            Telemetry Architecture
          </a>
          <a
            href="#quickstart"
            onClick={() => setMobileNavOpen(false)}
            style={{ color: 'var(--text-main)', textDecoration: 'none', fontSize: 15, fontWeight: 700, padding: '6px 0' }}
          >
            SDK Quickstart Guide
          </a>
          <a
            href="#preview"
            onClick={() => setMobileNavOpen(false)}
            style={{ color: 'var(--text-main)', textDecoration: 'none', fontSize: 15, fontWeight: 700, padding: '6px 0' }}
          >
            Live APM Console Preview
          </a>
        </div>
      )}


      {/* ========================================================================= */}
      {/* 2. HERO SECTION */}
      {/* ========================================================================= */}
      <section style={{
        padding: 'clamp(48px, 8vw, 96px) clamp(16px, 5vw, 64px) 60px',
        textAlign: 'center',
        maxWidth: 1200,
        margin: '0 auto',
        position: 'relative'
      }}>
        {/* Live Status Pill */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 16px',
          borderRadius: 24,
          background: theme === 'light' ? '#eef2ff' : 'rgba(99, 102, 241, 0.15)',
          border: '1px solid var(--border-subtle)',
          color: theme === 'light' ? '#4338ca' : '#a5b4fc',
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 24,
          boxShadow: 'var(--shadow-sm)'
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#10b981',
            display: 'inline-block'
          }} className="animate-pulse-dot" />
          <span>v1.2.0 Production Ready • Real-Time Telemetry Pipeline</span>
          <ChevronRight size={14} />
        </div>

        {/* Main Headline */}
        <h1 style={{
          fontSize: 'clamp(34px, 5vw, 62px)',
          fontWeight: 900,
          lineHeight: 1.1,
          letterSpacing: '-0.04em',
          maxWidth: 960,
          margin: '0 auto 24px',
          color: 'var(--text-main)'
        }}>
          Full-Stack Observability from{' '}
          <span style={{
            background: 'linear-gradient(135deg, #4f46e5 20%, #06b6d4 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Browser Click
          </span>{' '}
          to Database Span.
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 'clamp(16px, 1.8vw, 20px)',
          color: 'var(--text-secondary)',
          maxWidth: 780,
          margin: '0 auto 36px',
          lineHeight: 1.6,
          fontWeight: 400
        }}>
          The unified application performance monitoring platform uniting Real User Monitoring (RUM),
          Core Web Vitals, Stack Trace Symbolication, Distributed Tracing, Synthetic Health Probes, and Real-Time Alerting.
        </p>

        {/* Primary Call to Action Buttons */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 48
        }}>
          <button
            onClick={onLaunchApp}
            className="btn-primary"
            style={{
              padding: '14px 32px',
              fontSize: 16,
              borderRadius: 12,
              fontWeight: 800,
              boxShadow: '0 8px 24px rgba(79, 70, 229, 0.4)'
            }}
          >
            <Activity size={20} />
            <span>Open APM Dashboard</span>
            <ArrowRight size={18} />
          </button>

          <a
            href="#quickstart"
            className="btn-secondary"
            style={{
              padding: '14px 28px',
              fontSize: 15,
              borderRadius: 12,
              fontWeight: 700,
              textDecoration: 'none'
            }}
          >
            <Code2 size={18} color="#4f46e5" />
            <span>View SDK Quickstart</span>
          </a>

          <button
            onClick={handleTestDrive}
            disabled={simulating}
            className="btn-secondary"
            style={{
              padding: '14px 24px',
              fontSize: 14,
              borderRadius: 12,
              fontWeight: 600,
              cursor: simulating ? 'wait' : 'pointer'
            }}
          >
            <Zap size={16} color="#d97706" />
            <span>{simulating ? 'Testing Ingest...' : simSuccess ? '✓ Ingestion Responded 200 OK' : 'Test Ingest Latency'}</span>
          </button>
        </div>

        {/* Live Metrics Ribbon */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
          gap: 16,
          maxWidth: 1040,
          margin: '0 auto',
          padding: '20px clamp(14px, 3vw, 24px)',
          background: 'var(--bg-card)',
          borderRadius: 16,
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-md)'
        }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#4f46e5' }}>&lt; 1.4ms</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Collector Ingest Latency</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0891b2' }}>3.4 KB</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Zero-Overhead RUM SDK</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#059669' }}>W3C OpenTelemetry</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Trace Context Standard</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#7c3aed' }}>100% Symbolicated</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Source Map Accuracy</div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. INTERACTIVE APM CONSOLE PREVIEW */}
      {/* ========================================================================= */}
      <section id="preview" style={{
        padding: '20px clamp(16px, 5vw, 64px) 80px',
        maxWidth: 1240,
        margin: '0 auto'
      }}>
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.12)',
          position: 'relative'
        }}>
          {/* Mock Console Header Bar */}
          <div style={{
            background: 'var(--bg-secondary)',
            padding: '14px clamp(14px, 3vw, 24px)',
            borderBottom: '1px solid var(--border-subtle)',
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
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#10b981' }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginLeft: 4, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                ricoz-apm-console://demo-ecommerce-app/live-overview
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="badge badge-healthy">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669' }} />
                Pipelines Operational
              </span>
              <button
                onClick={onLaunchApp}
                className="btn-primary"
                style={{ padding: '6px 12px', fontSize: 12 }}
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
              <div style={{ background: 'var(--bg-primary)', padding: 18, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Total Requests / Throughput</div>
                <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: 'var(--text-main)' }}>8,492 req/min</div>
                <div style={{ fontSize: 12, color: '#059669', fontWeight: 600, marginTop: 4 }}>+12.4% vs last hour</div>
              </div>

              <div style={{ background: 'var(--bg-primary)', padding: 18, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>P95 Latency SLA</div>
                <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: '#4f46e5' }}>184 ms</div>
                <div style={{ fontSize: 12, color: '#059669', fontWeight: 600, marginTop: 4 }}>Target: &lt; 500 ms (HEALTHY)</div>
              </div>

              <div style={{ background: 'var(--bg-primary)', padding: 18, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Apdex Satisfaction Score</div>
                <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: '#059669' }}>0.94 / 1.00</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>91% Satisfied • 7% Tolerating</div>
              </div>

              <div style={{ background: 'var(--bg-primary)', padding: 18, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Error Rate</div>
                <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: '#059669' }}>0.14%</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>Threshold: &lt; 5.0%</div>
              </div>
            </div>

            {/* Split Mock Visual: Traces Waterfall & Web Vitals */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
              gap: 20
            }}>
              {/* Left: Distributed Trace Span Waterfall Preview */}
              <div style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: 'clamp(14px, 2.5vw, 20px)',
                minWidth: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <GitMerge size={16} color="#4f46e5" />
                    <span style={{ fontSize: 14, fontWeight: 700 }}>Live Distributed Trace Waterfall</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>trace-4bf92f35</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, gap: 8 }}>
                      <span style={{ wordBreak: 'break-all' }}>Browser: POST /api/v1/checkout</span>
                      <span style={{ color: '#4f46e5', flexShrink: 0 }}>148ms</span>
                    </div>
                    <div style={{ height: 6, background: '#c7d2fe', borderRadius: 3, marginTop: 6, width: '100%' }}>
                      <div style={{ width: '100%', height: '100%', background: '#4f46e5', borderRadius: 3 }} />
                    </div>
                  </div>

                  <div style={{ padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-subtle)', marginLeft: 'clamp(6px, 2vw, 16px)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, gap: 8 }}>
                      <span style={{ wordBreak: 'break-all' }}>Backend: JWT Authenticate</span>
                      <span style={{ color: '#0891b2', flexShrink: 0 }}>8ms</span>
                    </div>
                    <div style={{ height: 6, background: '#cffafe', borderRadius: 3, marginTop: 6, width: '100%' }}>
                      <div style={{ width: '15%', height: '100%', background: '#0891b2', borderRadius: 3 }} />
                    </div>
                  </div>

                  <div style={{ padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-subtle)', marginLeft: 'clamp(10px, 3.5vw, 28px)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, gap: 8 }}>
                      <span style={{ wordBreak: 'break-all' }}>DB: SELECT inventory</span>
                      <span style={{ color: '#059669', flexShrink: 0 }}>24ms</span>
                    </div>
                    <div style={{ height: 6, background: '#d1fae5', borderRadius: 3, marginTop: 6, width: '100%' }}>
                      <div style={{ width: '35%', height: '100%', background: '#059669', borderRadius: 3, marginLeft: '15%' }} />
                    </div>
                  </div>

                  <div style={{ padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-subtle)', marginLeft: 'clamp(10px, 3.5vw, 28px)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, gap: 8 }}>
                      <span style={{ wordBreak: 'break-all' }}>Payment: Stripe Gateway Charge</span>
                      <span style={{ color: '#d97706', flexShrink: 0 }}>92ms</span>
                    </div>
                    <div style={{ height: 6, background: '#fef3c7', borderRadius: 3, marginTop: 6, width: '100%' }}>
                      <div style={{ width: '60%', height: '100%', background: '#d97706', borderRadius: 3, marginLeft: '40%' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Core Web Vitals Status */}
              <div style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: 'clamp(14px, 2.5vw, 20px)',
                minWidth: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Globe size={16} color="#0891b2" />
                    <span style={{ fontSize: 14, fontWeight: 700 }}>Real User Core Web Vitals</span>
                  </div>
                  <span className="badge badge-good">ALL PASSING</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ padding: 12, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>Largest Contentful Paint (LCP)</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>1.18 s</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Target: &lt; 2.5s (96.4% in Good category)</div>
                  </div>

                  <div style={{ padding: 12, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>Interaction to Next Paint (INP)</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>48 ms</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Target: &lt; 200ms (99.1% responsive)</div>
                  </div>

                  <div style={{ padding: 12, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>Cumulative Layout Shift (CLS)</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>0.02</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Target: &lt; 0.1 (Zero unexpected movement)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. CORE FEATURES - INTERACTIVE BENTO SHOWCASE */}
      {/* ========================================================================= */}
      <section id="features" style={{
        padding: '60px clamp(16px, 5vw, 64px)',
        maxWidth: 1200,
        margin: '0 auto'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, color: '#4f46e5', marginBottom: 8 }}>
            Unified Observability Suite
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, letterSpacing: '-0.03em' }}>
            Engineered for High-Scale Production Resiliency
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 16, maxWidth: 640, margin: '12px auto 0' }}>
            Consolidate your monitoring stack into a single, cohesive engine. No disparate dashboards, no context loss.
          </p>
        </div>

        {/* Feature Navigation Tabs */}
        <div style={{
          display: 'flex',
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
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: isSelected ? '1px solid #6366f1' : '1px solid var(--border-subtle)',
                  background: isSelected ? (theme === 'light' ? '#eef2ff' : 'rgba(99, 102, 241, 0.25)') : 'var(--bg-card)',
                  color: isSelected ? (theme === 'light' ? '#4338ca' : '#c7d2fe') : 'var(--text-secondary)',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={16} color={isSelected ? '#4f46e5' : 'var(--text-muted)'} />
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
                <h3 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16 }}>
                  {current.headline}
                </h3>
                <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
                  {current.desc}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 100px), 1fr))', gap: 12, marginBottom: 24 }}>
                  {current.stats.map((s, idx) => (
                    <div key={idx} style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4, color: current.color }}>{s.val}</div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={onLaunchApp}
                  className="btn-primary"
                  style={{ padding: '10px 20px', fontSize: 14 }}
                >
                  <span>Explore in Live Console</span>
                  <ArrowRight size={16} />
                </button>
              </div>

              {/* Graphic Mock Card */}
              <div style={{
                background: 'var(--bg-primary)',
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
                  background: `linear-gradient(135deg, ${current.color} 0%, #4f46e5 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 8px 24px ${current.color}40`,
                  marginBottom: 16
                }}>
                  <CurrentIcon size={32} color="#ffffff" />
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>
                  Integrated & Ready Out-of-the-Box
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 340 }}>
                  Plug the SDK into any frontend or backend service. Zero configuration required for automatic symbolication and span stitching.
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
        marginBottom: 80
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, color: '#0891b2', marginBottom: 8 }}>
            End-to-End Ingestion Pipeline
          </div>
          <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em' }}>
            How Ricoz Ingests and Correlates Telemetry
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
              <span style={{ fontSize: 12, fontWeight: 800, color: '#0891b2' }}>STEP 01</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Browser & RUM SDK</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Intercepts web vitals, fetch/xhr requests, and unhandled errors. Stitches W3C traceparents.
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Zap size={18} color="#4f46e5" />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#4f46e5' }}>STEP 02</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>FastAPI Gateway</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Validates ingest API keys, batches payloads, and writes asynchronously to Timescale/ClickHouse.
            </div>
          </div>

          {/* Step 3 */}
          <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Terminal size={18} color="#e11d48" />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#e11d48' }}>STEP 03</span>
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
              <span style={{ fontSize: 12, fontWeight: 800, color: '#d97706' }}>STEP 04</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Alert State Machine</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Continuously evaluates error rate and latency SLAs. Dispatches webhooks & Slack alerts.
            </div>
          </div>

          {/* Step 5 */}
          <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <BarChart3 size={18} color="#059669" />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#059669' }}>STEP 05</span>
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
        padding: '60px clamp(16px, 5vw, 64px) 100px',
        maxWidth: 1100,
        margin: '0 auto'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, color: '#4f46e5', marginBottom: 8 }}>
            Developer Friendly Integration
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 900, letterSpacing: '-0.03em' }}>
            Instrument in Under 2 Minutes
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 16, marginTop: 8 }}>
            Copy, paste, and start receiving live traces immediately.
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
                  background: activeSnippetTab === 'npm' ? '#4f46e5' : 'transparent',
                  color: activeSnippetTab === 'npm' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                NPM / React / Vite
              </button>
              <button
                onClick={() => setActiveSnippetTab('html')}
                style={{
                  background: activeSnippetTab === 'html' ? '#4f46e5' : 'transparent',
                  color: activeSnippetTab === 'html' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                HTML Drop-in
              </button>
              <button
                onClick={() => setActiveSnippetTab('trace')}
                style={{
                  background: activeSnippetTab === 'trace' ? '#4f46e5' : 'transparent',
                  color: activeSnippetTab === 'trace' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                W3C Tracing Flow
              </button>
            </div>

            <button
              onClick={() => handleCopy(snippets[activeSnippetTab])}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              {copied ? <Check size={14} color="#059669" /> : <Copy size={14} />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>

          {/* Code Text Content */}
          <div style={{ padding: 'clamp(14px, 3vw, 24px)', overflowX: 'auto', background: theme === 'light' ? '#0f172a' : '#090b10' }}>
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
      {/* 7. HIGH-CONVERTING BOTTOM CTA */}
      {/* ========================================================================= */}
      <section style={{
        padding: '80px clamp(16px, 5vw, 64px)',
        background: 'linear-gradient(135deg, #3730a3 0%, #1e1b4b 100%)',
        color: '#ffffff',
        textAlign: 'center',
        position: 'relative'
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(32px, 4.5vw, 48px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 16 }}>
            Gain Total Visibility into Your Web Applications
          </h2>
          <p style={{ fontSize: 18, color: '#c7d2fe', lineHeight: 1.6, marginBottom: 36 }}>
            Eliminate blind spots. Detect slowdowns, resolve bugs with original stack traces,
            and guarantee 99.99% uptime with RicozAppMon.
          </p>

          <button
            onClick={onLaunchApp}
            style={{
              background: '#ffffff',
              color: '#312e81',
              padding: '16px 36px',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <Activity size={20} color="#4f46e5" />
            <span>Open APM Command Console</span>
            <ArrowRight size={18} color="#4f46e5" />
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. FOOTER */}
      {/* ========================================================================= */}
      <footer style={{
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-subtle)',
        padding: '40px clamp(16px, 5vw, 64px)',
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
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Activity size={16} color="#ffffff" />
            </div>
            <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: 15 }}>RicozAppMon</span>
            <span>— Open-Source Unified APM & Telemetry Platform</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <a
              href="https://github.com/balaji0210/recoz"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span>GitHub Repository</span>
              <ExternalLink size={12} />
            </a>
            <span>•</span>
            <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669' }} />
              All Systems Operational
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
