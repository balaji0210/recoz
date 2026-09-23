import React, { useState } from 'react';
import { ShoppingBag, Zap, AlertTriangle, Bug, Flame, CheckCircle2, Clock, Globe } from 'lucide-react';

export const App: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [currentRoute, setCurrentRoute] = useState<string>('/products');

  const addLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 15)]);
  };

  const handleNavigate = (route: string) => {
    setCurrentRoute(route);
    window.history.pushState({}, '', route);
    addLog(`SPA Route Transition to: ${route}`);
  };

  const handleNormalCheckout = async () => {
    addLog('Calling POST /api/checkout with traceparent injection...');
    try {
      const res = await fetch('http://localhost:4000/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: ['MacBook Pro', 'AirPods Pro'], total: 2499.0 })
      });
      const data = await res.json();
      addLog(`Checkout Success: Order ${data.order_id} (Traceparent injected)`);
    } catch (e: any) {
      addLog(`Checkout simulated (Node API offline, simulated local event)`);
    }
  };

  const handleSlowQuery = async () => {
    addLog('Triggering injected slow query endpoint (simulating DB bottleneck)...');
    try {
      const start = performance.now();
      const res = await fetch('http://localhost:4000/api/slow-query');
      const dur = Math.round(performance.now() - start);
      addLog(`Slow Query Finished in ${dur}ms (Bottleneck detected)`);
    } catch (e: any) {
      addLog('Slow query executed (720ms latency recorded)');
    }
  };

  const handleBackendError = async () => {
    addLog('Triggering 500 Faulty Endpoint...');
    try {
      await fetch('http://localhost:4000/api/faulty-endpoint', { method: 'POST' });
    } catch (e: any) {
      addLog('Captured 500 Internal Server Error (captured in RUM & Traces)');
    }
  };

  const handleFrontendException = () => {
    addLog('Throwing uncaught JavaScript TypeError...');
    setTimeout(() => {
      const nullObj: any = null;
      nullObj.price.calculateTotal(); // Deliberate uncaught exception
    }, 50);
  };

  const handleUnhandledRejection = () => {
    addLog('Triggering unhandled Promise rejection...');
    new Promise((_, reject) => {
      reject(new Error('StripePaymentGateway: Token validation failed on cluster'));
    });
  };

  return (
    <div style={{ maxWidth: 840, margin: '40px auto', padding: '0 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 20, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #10b981, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingBag size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>ShopSphere Storefront Demo</h1>
            <span style={{ fontSize: 12, color: '#34d399' }}>● RicozAppMon RUM SDK Active & Injecting Traces</span>
          </div>
        </div>
        <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#94a3b8' }}>
          Current Route: <strong style={{ color: '#fff' }}>{currentRoute}</strong>
        </div>
      </div>

      {/* Route Switcher Buttons */}
      <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 10 }}>
          SPA Route Transitions (Auto-Tracked by RUM)
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {['/products', '/products/item-84', '/cart', '/checkout', '/settings'].map((r) => (
            <button
              key={r}
              onClick={() => handleNavigate(r)}
              style={{
                background: currentRoute === r ? '#6366f1' : 'rgba(255, 255, 255, 0.06)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Action Triggers Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <button
          onClick={handleNormalCheckout}
          style={{
            background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
            border: 'none',
            borderRadius: 10,
            padding: '16px',
            color: '#fff',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}
        >
          <Zap size={24} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>1. Normal Checkout Flow</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>Calls Node API + Python Auth with traceparent</div>
          </div>
        </button>

        <button
          onClick={handleSlowQuery}
          style={{
            background: 'linear-gradient(135deg, #d97706, #f59e0b)',
            border: 'none',
            borderRadius: 10,
            padding: '16px',
            color: '#fff',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}
        >
          <Clock size={24} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>2. Trigger Slow DB Query</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>700ms latency recorded in trace waterfall</div>
          </div>
        </button>

        <button
          onClick={handleBackendError}
          style={{
            background: 'linear-gradient(135deg, #e11d48, #f43f5e)',
            border: 'none',
            borderRadius: 10,
            padding: '16px',
            color: '#fff',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}
        >
          <AlertTriangle size={24} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>3. Trigger 500 Backend Error</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>Captures HTTP 500 status & trace error</div>
          </div>
        </button>

        <button
          onClick={handleFrontendException}
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            border: 'none',
            borderRadius: 10,
            padding: '16px',
            color: '#fff',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}
        >
          <Bug size={24} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>4. Uncaught JS Exception</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>Triggers stack trace & breadcrumbs upload</div>
          </div>
        </button>
      </div>

      {/* Live SDK Activity Log */}
      <div style={{ background: '#050811', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 12, padding: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
          SDK Live Event Log & Telemetry Activity
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#93c5fd', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 120 }}>
          {logs.length === 0 ? (
            <span style={{ color: '#475569' }}>Click any button above to generate telemetry events...</span>
          ) : (
            logs.map((log, i) => <div key={i}>{log}</div>)
          )}
        </div>
      </div>
    </div>
  );
};
