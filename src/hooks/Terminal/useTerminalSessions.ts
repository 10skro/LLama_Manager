import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface TerminalSession {
  sessionId: string;
  configId: string;
  versionId: number;
}

export function useTerminalSessions() {
  const [sessions, setSessions] = useState<TerminalSession[]>([]);

  const refreshSessions = useCallback(async () => {
    try {
      const active = await invoke<TerminalSession[]>('list_active_terminals');
      setSessions(active);
    } catch (err) {
      console.error('Failed to refresh terminal sessions:', err);
    }
  }, []);

  useEffect(() => {
    // Initial load
    refreshSessions();

    // Listen for session changes triggered by spawn/kill from main window
    const unlisten = listen('terminal-sessions-update', () => {
      refreshSessions();
    });

    // Listen for terminal-exit events (process exited on its own)
    const unlistenExit = listen<string>('terminal-exit', () => {
      refreshSessions();
    });

    return () => {
      unlisten.then((u) => u());
      unlistenExit.then((u) => u());
    };
  }, [refreshSessions]);

  return { sessions, refreshSessions };
}
