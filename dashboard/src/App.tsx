import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewPage } from './pages/OverviewPage';
import { RumPage } from './pages/RumPage';
import { ErrorsPage } from './pages/ErrorsPage';
import { TracesPage } from './pages/TracesPage';
import { SyntheticsPage } from './pages/SyntheticsPage';
import { AlertsPage } from './pages/AlertsPage';
import { SettingsPage } from './pages/SettingsPage';
import { LandingPage } from './pages/LandingPage';
import { api } from './api/client';
import { Application } from './types';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>(() => {
    return localStorage.getItem('rz_active_tab') || 'overview';
  });
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>('demo-ecommerce-app-id');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (isMobileSidebarOpen) {
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
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    localStorage.setItem('rz_active_tab', currentTab);
  }, [currentTab]);
  
  // Theme state defaulting to light mode
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('rz_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rz_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      const apps = await api.getApplications();
      setApplications(apps);
      if (apps.length > 0) {
        setSelectedAppId(apps[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSimulateTraffic = async () => {
    setToastMessage('⚡ Simulated 15 user sessions & distributed backend traces successfully dispatched!');
    setTimeout(() => setToastMessage(null), 3500);
  };

  // If user navigated to Landing Page, render full screen experience
  if (currentTab === 'landing') {
    return (
      <LandingPage
        onLaunchApp={() => setCurrentTab('overview')}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    );
  }

  const renderCurrentPage = () => {
    switch (currentTab) {
      case 'overview':
        return <OverviewPage appId={selectedAppId} timeRange={timeRange} setCurrentTab={setCurrentTab} />;
      case 'rum':
        return <RumPage appId={selectedAppId} timeRange={timeRange} />;
      case 'errors':
        return <ErrorsPage appId={selectedAppId} />;
      case 'traces':
        return <TracesPage appId={selectedAppId} />;
      case 'synthetics':
        return <SyntheticsPage appId={selectedAppId} />;
      case 'alerts':
        return <AlertsPage appId={selectedAppId} />;
      case 'settings':
        return <SettingsPage appId={selectedAppId} applications={applications} />;
      default:
        return <OverviewPage appId={selectedAppId} timeRange={timeRange} setCurrentTab={setCurrentTab} />;
    }
  };

  return (
    <div data-theme={theme} style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-main)', overflowX: 'clip' }}>
      {/* Sidebar (Desktop sticky & Mobile drawer) */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        applications={applications}
        selectedAppId={selectedAppId}
        setSelectedAppId={setSelectedAppId}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%' }}>
        <Header
          timeRange={timeRange}
          setTimeRange={setTimeRange}
          onTriggerTraffic={handleSimulateTraffic}
          theme={theme}
          toggleTheme={toggleTheme}
          onGoLanding={() => setCurrentTab('landing')}
          onToggleMobileMenu={() => setIsMobileSidebarOpen(prev => !prev)}
        />

        {/* Global Toast Notification */}
        {toastMessage && (
          <div style={{
            margin: '14px clamp(14px, 3vw, 28px) 0',
            padding: '12px 18px',
            background: theme === 'light' ? '#eef2ff' : 'rgba(99, 102, 241, 0.2)',
            border: `1px solid ${theme === 'light' ? '#c7d2fe' : '#6366f1'}`,
            borderRadius: 10,
            color: theme === 'light' ? '#3730a3' : '#c7d2fe',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            {toastMessage}
          </div>
        )}

        <main style={{ flex: 1, minWidth: 0 }}>
          {renderCurrentPage()}
        </main>
      </div>
    </div>
  );
};

