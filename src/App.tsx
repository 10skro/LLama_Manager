import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/Layout/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/toaster';
import { DashboardPage } from './pages/DashboardPage';
import { CatalogPage } from './pages/CatalogPage';
import { SettingsPage } from './pages/SettingsPage';
import { ConfigsPage } from './pages/ConfigsPage';
import { fetchBuilds, checkNewBuilds, getCatalogLastFetched } from './services/github';
import { getSettings, saveSettings } from './services/settings';

import { getCustomCommands } from './services/customCommand';
import { getThemeById, DEFAULT_THEME_ID } from './themes';
import { DEFAULT_FONT_FAMILY } from './fonts';
import { useAppStore } from './store/useAppStore';
import { useRefreshStore } from './store/useRefreshStore';
import { useTheme } from './hooks/useTheme';
import { useAppUpdate } from './hooks/useAppUpdate';
import { useToast } from './hooks/use-toast';
import { UpdateModal } from './components/UpdateModal';
import { ChangelogModal } from './components/ChangelogModal';
import type { AppSettings, Build } from './types';

function App() {
  const queryClient = useQueryClient();
  useTheme(); // Apply theme reactively
  const { updateInfo, isChecking } = useAppUpdate();
  const { settings } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [updateCheckCompleted, setUpdateCheckCompleted] = useState(false);

  // Post-installation changelog modal
  const [showPostInstallChangelog, setShowPostInstallChangelog] = useState(false);
  const [postInstallChangelogBody, setPostInstallChangelogBody] = useState<string | null>(null);
  const [postInstallChangelogVersion, setPostInstallChangelogVersion] = useState<string | null>(null);

  // Show update modal on startup if update available and setting is enabled
  // Wait for the real update check (isChecking) to finish instead of using an arbitrary timeout
  useEffect(() => {
    if (updateCheckCompleted) return;

    if (!isChecking) {
      // The update check has completed (isChecking went from true to false)
      setUpdateCheckCompleted(true);
      const shouldShow = updateInfo.available && (settings?.show_update_modal ?? true);
      if (shouldShow) {
        setShowModal(true);
      }
    }
  }, [isChecking, updateCheckCompleted, updateInfo.available, settings?.show_update_modal]);

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
          show_update_modal: settings.show_update_modal ?? true,
          toast_duration: settings.toast_duration ?? 5000,
          font_family: settings.font_family,
          model_folder: settings.model_folder,
          mmproj_folder: settings.mmproj_folder,
          pending_changelog_version: settings.pending_changelog_version,
          pending_changelog_body: settings.pending_changelog_body,
        };
        useAppStore.getState().setSettings(merged);

        // Show post-installation changelog modal if pending changelog exists
        if (settings.pending_changelog_version && settings.pending_changelog_body) {
          setPostInstallChangelogVersion(settings.pending_changelog_version);
          setPostInstallChangelogBody(settings.pending_changelog_body);
          setShowPostInstallChangelog(true);
        }

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

  // Intelligent startup check: verify with GitHub via ETag + populate notification bell
  useEffect(() => {
    const checkAndLoad = async () => {
      try {
        const builds = await fetchBuilds({ forceRefresh: false });
        queryClient.setQueryData<Build[]>(['builds', undefined], builds);
        const ts = await getCatalogLastFetched();
        useRefreshStore.setState({ lastFetched: ts });

        // Check for new builds and populate the notification bell
        const newBuilds = await checkNewBuilds();
        if (newBuilds.length > 0) {
          const buildLabels = newBuilds.map((b: Build) => `${b.build_number} / ${b.backend} / ${b.architecture}`);
          useAppStore.getState().setNewBuilds(buildLabels);
        }
      } catch (err) {
        console.error('Failed to check builds on startup:', err);
      }
    };
    checkAndLoad();
  }, [queryClient]);

  // Background auto-refresh: check for new builds every 60 minutes
  const { toast } = useToast();
  useEffect(() => {
    const AUTO_REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

    const autoRefresh = async () => {
      try {
        const newBuilds = await checkNewBuilds();

        if (newBuilds.length > 0) {
          // New builds found — fetch full catalog and update cache
          const freshBuilds = await fetchBuilds({ forceRefresh: true });
          queryClient.setQueryData<Build[]>(['builds', undefined], freshBuilds);
          const ts = await getCatalogLastFetched();
          useRefreshStore.setState({ lastFetched: ts });

          // Populate notification bell
          const buildLabels = newBuilds.map((b: Build) => `${b.build_number} / ${b.backend} / ${b.architecture}`);
          useAppStore.getState().setNewBuilds(buildLabels);

          toast({
            title: 'Update found',
            description: `${newBuilds.length} build(s) not yet installed.`,
          });
        } else {
          // No new builds — clear any stale bell notifications
          useAppStore.getState().setNewBuilds([]);
        }
        // If 0 new builds: silent — no toast, no update
      } catch (err) {
        // Silent on error — don't spam the user with hourly error toasts
        console.error('Auto-refresh failed:', err);
      }
    };

    const intervalId = setInterval(autoRefresh, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [queryClient, toast]);

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
      <UpdateModal open={showModal} onOpenChange={setShowModal} />
      <ChangelogModal
        open={showPostInstallChangelog}
        onOpenChange={async (open) => {
          setShowPostInstallChangelog(open);
          if (!open) {
            // Clear pending changelog after the user has seen it
            try {
              const current = useAppStore.getState().settings;
              await saveSettings({
                ...current,
                pending_changelog_version: undefined,
                pending_changelog_body: undefined,
              });
              useAppStore.getState().setSettings({
                ...current,
                pending_changelog_version: undefined,
                pending_changelog_body: undefined,
              });
            } catch (err) {
              console.error('Failed to clear pending changelog:', err);
            }
          }
        }}
        buildNumber={postInstallChangelogVersion ?? 'Update'}
        body={postInstallChangelogBody}
      />
      <Toaster />
    </ErrorBoundary>
  );
}

export default App;
