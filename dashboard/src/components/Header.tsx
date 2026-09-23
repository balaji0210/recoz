import React from 'react';
import { Clock, Search, Zap, Sun, Moon, ShieldCheck, User } from 'lucide-react';

interface HeaderProps {
  timeRange: string;
  setTimeRange: (tr: string) => void;
  onTriggerTraffic?: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  timeRange,
  setTimeRange,
  onTriggerTraffic,
  theme,
  toggleTheme
}) => {
  return (
    <header className="glass-header" style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', position: 'sticky', top: 0, zIndex: 30 }}>
      {/* Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: 380 }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search traces, errors, routes, or spans..."
            style={{
              width: '100%',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '8px 12px 8px 36px',
              color: 'var(--text-main)',
              fontSize: 12,
              outline: 'none',
              transition: 'all 0.2s ease'
            }}
          />
        </div>
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Time Range Selector */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 3 }}>
          {['1h', '24h', '7d', '30d'].map((tr) => {
            const isSelected = timeRange === tr;
            return (
              <button
                key={tr}
                onClick={() => setTimeRange(tr)}
                style={{
                  background: isSelected ? (theme === 'light' ? '#ffffff' : 'rgba(99, 102, 241, 0.25)') : 'transparent',
                  color: isSelected ? 'var(--accent-indigo)' : 'var(--text-muted)',
                  boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                  border: 'none',
                  borderRadius: 6,
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tr}
              </button>
            );
          })}
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle light and dark theme"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: '7px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            color: 'var(--text-main)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          {theme === 'light' ? (
            <>
              <Sun size={15} color="#d97706" />
              <span>Light</span>
            </>
          ) : (
            <>
              <Moon size={15} color="#818cf8" />
              <span>Dark</span>
            </>
          )}
        </button>

        {/* Live Traffic Simulator Button */}
        {onTriggerTraffic && (
          <button
            onClick={onTriggerTraffic}
            className="btn-primary"
            style={{ fontSize: 12, padding: '7px 14px' }}
          >
            <Zap size={14} />
            <span>Simulate Traffic</span>
          </button>
        )}

        {/* User Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 10, borderLeft: '1px solid var(--border-subtle)' }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: 12,
            boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)'
          }}>
            AD
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>Admin</div>
            <div style={{ fontSize: 10, color: '#059669', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669' }} />
              Live Online
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
