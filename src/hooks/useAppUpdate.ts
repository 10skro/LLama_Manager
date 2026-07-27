import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from './use-toast';

interface AppUpdateInfo {
  available: boolean;
  version: string | null;
  date: string | null;
  body: string | null;
}

export function useAppUpdate() {
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo>({
    available: false,
    version: null,
    date: null,
    body: null,
  });
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkUpdate = useCallback(async () => {
    try {
      setError(null);
      setIsChecking(true);
      const result = await invoke<AppUpdateInfo>('check_app_update');
      setUpdateInfo(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error('Failed to check for app updates:', err);
    } finally {
      setIsChecking(false);
    }
  }, []);

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
