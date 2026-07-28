import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/store/useAppStore';

interface AppUpdateInfo {
  available: boolean;
  version: string | null;
  date: string | null;
  body: string | null;
}

// Module-level lock to prevent duplicate concurrent check_app_update calls
let pendingCheck: Promise<void> | null = null;

export function useAppUpdate() {
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read from global store (shared between Header, Settings, etc.)
  const appUpdateAvailable = useAppStore((s) => s.appUpdateAvailable);
  const appUpdateVersion = useAppStore((s) => s.appUpdateVersion);
  const appUpdateDate = useAppStore((s) => s.appUpdateDate);
  const appUpdateBody = useAppStore((s) => s.appUpdateBody);
  const setAppUpdate = useAppStore((s) => s.setAppUpdate);

  const updateInfo = {
    available: appUpdateAvailable,
    version: appUpdateVersion,
    date: appUpdateDate,
    body: appUpdateBody,
  };

  const checkUpdate = useCallback(async () => {
    // Deduplicate: if a check is already in progress, reuse it
    if (pendingCheck) {
      return pendingCheck;
    }

    const promise = (async () => {
      try {
        setError(null);
        setIsChecking(true);
        const result = await invoke<AppUpdateInfo>('check_app_update');
        setAppUpdate(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        console.error('Failed to check for app updates:', err);
      } finally {
        setIsChecking(false);
        pendingCheck = null;
      }
    })();

    pendingCheck = promise;
    return promise;
  }, [setAppUpdate]);

  const installUpdate = useCallback(async () => {
    try {
      setError(null);
      setIsInstalling(true);
      await invoke('install_app_update');
      // The app will restart after install, so we don't reset state here
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setIsInstalling(false);
      console.error('Failed to install app update:', err);
    }
  }, []);

  // Check for updates on mount
  useEffect(() => {
    checkUpdate();
  }, [checkUpdate]);

  return {
    updateInfo,
    isChecking,
    isInstalling,
    error,
    checkUpdate,
    installUpdate,
  };
}
