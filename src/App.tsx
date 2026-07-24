import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/Layout/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/toaster';
import { DashboardPage } from './pages/DashboardPage';
import { CatalogPage } from './pages/CatalogPage';
import { SettingsPage } from './pages/SettingsPage';
import { fetchBuilds, getCatalogLastFetched } from './services/github';
import { getSettings } from './services/settings';
import { getThemeById, DEFAULT_THEME_ID } from './themes';
import { DEFAULT_FONT_FAMILY } from './fonts';
import { useAppStore } from './store/useAppStore';
import { useRefreshStore } from './store/useRefreshStore';
import { useTheme } from './hooks/useTheme';
import type { Build } from './types';

function App() {
  const queryClient = useQueryClient();
  useTheme(); // Apply theme reactively

  // Load settings and restore saved theme on app startup
  useEffect(() => {
    const loadSettingsAndTheme = async () => {
      try {
        const settings = await getSettings();
        const merged = {
          storage_path: settings.storage_path ?? '',
          theme: settings.theme ?? DEFAULT_THEME_ID,
          auto_check_updates: settings.auto_check_updates ?? true,
          toast_duration: settings.toast_duration ?? 5000,
        };
        useAppStore.getState().setSettings(merged);

        if (settings.theme) {
          const theme = getThemeById(settings.theme);
          if (theme) {
            useAppStore.getState().setActiveTheme(settings.theme);
          }
        }

        // Apply saved font on startup
        const fontFamily = settings.font_family ?? DEFAULT_FONT_FAMILY;
        document.documentElement.style.setProperty('--custom-font', fontFamily);
      } catch (err) {
        console.error('Failed to load settings on startup:', err);
      }
    };

    loadSettingsAndTheme();
  }, []);

  // Intelligent startup check: always verify with GitHub via ETag
  useEffect(() => {
    const checkAndLoad = async () => {
      try {
        const builds = await fetchBuilds({ forceRefresh: false });
        queryClient.setQueryData<Build[]>(['builds', undefined], builds);
        const ts = await getCatalogLastFetched();
        useRefreshStore.setState({ lastFetched: ts });
      } catch (err) {
        console.error('Failed to check builds on startup:', err);
      }
    };
    checkAndLoad();
  }, [queryClient]);

  return (
    <ErrorBoundary>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppShell>
      <Toaster />
    </ErrorBoundary>
  );
}

export default App;
