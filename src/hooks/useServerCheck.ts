import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ServerCheckResult {
  serversRunning: boolean;
  activeCount: number;
}

/**
 * Reusable hook that encapsulates the "check for running servers before update"
 * logic shared between UpdateModal, Header, and SettingsPage.
 *
 * Returns state + handlers to:
 *  - Check if servers are running (with safe-by-default fallback)
 *  - Show/hide the warning dialog
 *  - Kill all servers and proceed with the update
 */
export function useServerCheck() {
  const [showWarning, setShowWarning] = useState(false);
  const [stoppingServers, setStoppingServers] = useState(false);

  /**
   * Check if any terminal sessions are currently running.
   * Safe-by-default: if the check fails, assumes servers might be running.
   * Returns true if servers are running (caller should show warning).
   */
  const checkActiveServers = useCallback((): Promise<ServerCheckResult> => {
    return (async () => {
      try {
        const activeSessions = await invoke<Array<{ sessionId: string }>>('list_active_terminals');
        const count = activeSessions.length;
        console.log(`[SERVER_CHECK] Active terminals: ${count} session(s)`);
        return { serversRunning: count > 0, activeCount: count };
      } catch (err) {
        console.error(
          '[SERVER_CHECK] Failed to check active terminals (safe-by-default: assuming servers running):',
          err
        );
        return { serversRunning: true, activeCount: -1 }; // -1 = unknown (check failed)
      }
    })();
  }, []);

  /**
   * Guard: check servers and return true if the caller should proceed,
   * false if the warning dialog should be shown.
   */
  const shouldShowWarning = useCallback(async (): Promise<boolean> => {
    const result = await checkActiveServers();
    if (result.serversRunning) {
      console.log(
        `[SERVER_CHECK] Servers running (${result.activeCount} active) — warning dialog SHOULD show`
      );
      setShowWarning(true);
      return true;
    }
    console.log('[SERVER_CHECK] No servers running — safe to proceed');
    return false;
  }, [checkActiveServers]);

  /**
   * Kill all terminal sessions and return once processes are terminated.
   * Used after the user confirms the warning dialog.
   */
  const killAllServers = useCallback(async () => {
    setShowWarning(false);
    setStoppingServers(true);
    console.log('[SERVER_CHECK] Killing all terminal sessions...');

    try {
      await invoke('kill_all_terminals');
    } catch {
      console.warn(
        '[SERVER_CHECK] kill_all_terminals failed — proceeding anyway (backend has safety net)'
      );
    }

    // Small delay to ensure processes are terminated
    await new Promise((resolve) => setTimeout(resolve, 500));
    setStoppingServers(false);
    console.log('[SERVER_CHECK] Server shutdown complete');
  }, []);

  return {
    showWarning,
    setShowWarning,
    stoppingServers,
    checkActiveServers,
    shouldShowWarning,
    killAllServers,
  };
}
