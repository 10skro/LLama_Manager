import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/Layout/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/toaster';
import { DashboardPage } from './pages/DashboardPage';
import { CatalogPage } from './pages/CatalogPage';
import { SettingsPage } from './pages/SettingsPage';
import { fetchBuilds } from './services/github';
import { getSettings } from './services/settings';
import { getThemeById } from './themes';
import { useAppStore } from './store/useAppStore';
import { useTheme } from './hooks/useTheme';

function App() {
  const queryClient = useQueryClient();
  useTheme(); // Apply theme reactively

  // Load settings and restore saved theme on app startup
  useEffect(() => {
    const loadSettingsAndTheme = async () => {
      try {
        const settings = await getSettings();
        useAppStore.getState().setSettings(settings);

        if (settings.theme) {
          const theme = getThemeById(settings.theme);
          if (theme) {
            useAppStore.getState().setActiveTheme(settings.theme);
          }
        }
      } catch (err) {
        console.error('Failed to load settings on startup:', err);
      }
    };

    loadSettingsAndTheme();
  }, []);

  // Prefetch builds on app startup so the catalog page has data ready
  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ['builds', 10], // Match default buildLimit from CatalogPage
      queryFn: () => fetchBuilds(10),
      staleTime: Infinity,
    }).catch(() => {
      // Silently fail — catalog page will handle errors on its own
    });
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
