import React from 'react';
import { Clock, Search, Zap, Sun, Moon, ShieldCheck, User, Sparkles, Menu } from 'lucide-react';

interface HeaderProps {
  timeRange: string;
  setTimeRange: (tr: string) => void;
  onTriggerTraffic?: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onGoLanding?: () => void;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  timeRange,
  setTimeRange,
  onTriggerTraffic,
  theme,
  toggleTheme,
  onGoLanding,
  onToggleMobileMenu
}) => {
  return (
    <header
      className="glass-header"
      style={{
        minHeight: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px clamp(12px, 3vw, 28px)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        width: '100%',
        gap: 12,
        flexWrap: 'wrap'
      }}
    >
      {/* Left: Mobile Hamburger & Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 180px', minWidth: 0, maxWidth: '100%' }}>
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            aria-label="Open Navigation Menu"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '7px 9px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-main)',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <Menu size={18} />
          </button>
        )}

        <div style={{ position: 'relative', flex: 1, minWidth: 80, maxWidth: 380 }}>
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search telemetry..."
            style={{
              width: '100%',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '7px 10px 7px 32px',
              color: 'var(--text-main)',
              fontSize: 12,
              outline: 'none',
              transition: 'all 0.2s ease',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {/* Time Range Selector */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 2 }}>
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
                  padding: '4px 6px',
                  fontSize: 11,
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
            padding: '7px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--text-main)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          {theme === 'light' ? (
            <>
              <Sun size={14} color="#d97706" />
              <span className="hide-on-small-mobile">Light</span>
            </>
          ) : (
            <>
              <Moon size={14} color="#818cf8" />
              <span className="hide-on-small-mobile">Dark</span>
            </>
          )}
        </button>

        {/* Landing Page Link */}
        {onGoLanding && (
          <button
            onClick={onGoLanding}
            className="btn-secondary hide-on-small-mobile"
            style={{ fontSize: 12, padding: '7px 10px' }}
            title="View Product Landing Page"
          >
            <Sparkles size={14} color="var(--primary)" />
            <span>Landing</span>
          </button>
        )}

        {/* Live Traffic Simulator Button */}
        {onTriggerTraffic && (
          <button
            onClick={onTriggerTraffic}
            className="btn-primary"
            style={{ fontSize: 12, padding: '7px 12px' }}
            title="Simulate 15 live user sessions"
          >
            <Zap size={14} color="#C9A96E" />
            <span className="hide-on-small-mobile">Simulate</span>
          </button>
        )}

        {/* User Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 6, borderLeft: '1px solid var(--border-subtle)' }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6B1A1A, #C9A96E)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: 11,
            boxShadow: '0 2px 6px rgba(107, 26, 26, 0.25)',
            flexShrink: 0
          }}>
            RZ
          </div>
          <div className="hide-on-mobile">
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.2 }}>Admin</div>
            <div style={{ fontSize: 10, color: '#059669', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#059669' }} />
              Live Online
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

