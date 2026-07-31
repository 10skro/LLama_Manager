import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { DownloadPanel } from '@/components/Download/DownloadPanel';
import { DevBanner } from '@/components/DevBanner';
import { useAppStore } from '@/store/useAppStore';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const syncTerminalSessions = useAppStore((state) => state.syncTerminalSessions);
  const updateTerminalStatus = useAppStore((state) => state.updateTerminalStatus);
  const clearTerminalSession = useAppStore((state) => state.clearTerminalSession);

  // On mount: sync terminal sessions from backend
  useEffect(() => {
    async function sync() {
      try {
        const sessions: { sessionId: string; versionId: number }[] =
          await invoke('list_active_terminals');
        syncTerminalSessions(sessions);
      } catch (err) {
        console.error('Failed to sync running terminals:', err);
      }
    }
    sync();
  }, [syncTerminalSessions]);

  // Global listener for terminal-exit events — reason field from Rust payload
  // distinguishes intentional stops ("killed") from unexpected crashes ("exited").
  // Single-event approach eliminates the race condition of the former two-event pattern.
  useEffect(() => {
    const unlistenExit = listen<{ sessionId: string; reason: 'killed' | 'exited' }>(
      'terminal-exit',
      (event) => {
        const { sessionId, reason } = event.payload;

        // Find which version this session belongs to
        let foundVersionId: number | undefined;
        for (const [vidStr, session] of Object.entries(useAppStore.getState().terminalSessions)) {
          if (session.sessionId === sessionId) {
            foundVersionId = Number(vidStr);
            break;
          }
        }
        if (foundVersionId === undefined) return;

        const currentSession = useAppStore.getState().terminalSessions[foundVersionId];
        if (!currentSession) return;

        if (reason === 'killed') {
          // Intentional stop (user clicked Stop or X in terminal window) — clean up.
          clearTerminalSession(foundVersionId);
        } else if (currentSession.status === 'error') {
          // Process already in error state and has now fully exited — just remove.
          clearTerminalSession(foundVersionId);
        } else {
          // Unexpected crash (was 'starting' or 'running') — show persistent error badge.
          // The terminal instance still exists, user can check logs then click Stop to kill it.
          updateTerminalStatus(foundVersionId, 'error', sessionId);
        }
      }
    );

    return () => {
      unlistenExit.then((u) => u());
    };
  }, [clearTerminalSession, updateTerminalStatus]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      <DevBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </div>
        <DownloadPanel />
      </div>
    </div>
  );
}
