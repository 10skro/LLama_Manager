import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/Layout/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/toaster';
import { DashboardPage } from './pages/DashboardPage';
import { CatalogPage } from './pages/CatalogPage';
import { SettingsPage } from './pages/SettingsPage';
import { ConfigsPage } from './pages/ConfigsPage';
import { fetchBuilds, getCatalogLastFetched } from './services/github';
import { getSettings } from './services/settings';

import { getCustomCommands } from './services/customCommand';
import { getThemeById, DEFAULT_THEME_ID } from './themes';
import { DEFAULT_FONT_FAMILY } from './fonts';
import { useAppStore } from './store/useAppStore';
import { useRefreshStore } from './store/useRefreshStore';
import { useTheme } from './hooks/useTheme';
import type { AppSettings, Build } from './types';

function App() {
  const queryClient = useQueryClient();
  useTheme(); // Apply theme reactively

  // Load settings and restore saved theme on app startup
  // Theme is already applied by inline script in index.html from __INITIAL_THEME__ (injected by Rust)
  useEffect(() => {
    const loadSettingsAndTheme = async () => {
      try {
        const settings = await getSettings();
        const merged: AppSettings = {
          storage_path: settings.storage_path ?? '',
          theme: settings.theme ?? DEFAULT_THEME_ID,
          auto_check_updates: settings.auto_check_updates ?? true,
          toast_duration: settings.toast_duration ?? 5000,
          font_family: settings.font_family,
          model_folder: settings.model_folder,
          mmproj_folder: settings.mmproj_folder,
        };
        useAppStore.getState().setSettings(merged);

        // Only update theme if it actually differs from the current store value
        // (store already initialized from __INITIAL_THEME__ injected by Rust)
        const currentTheme = useAppStore.getState().activeTheme;
        if (settings.theme && settings.theme !== currentTheme) {
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

  // Load custom commands into the store on startup
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const customCommands = await getCustomCommands().catch(() => []);
        useAppStore.getState().setCustomCommands(customCommands);
      } catch (err) {
        console.error('Failed to load configs on startup:', err);
      }
    };
    loadConfigs();
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
          <Route path="/configs" element={<ConfigsPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppShell>
      <Toaster />
    </ErrorBoundary>
  );
}

export default App;
