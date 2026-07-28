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
  const syncRunningTerminals = useAppStore((state) => state.syncRunningTerminals);
  const removeRunningTerminalBySessionId = useAppStore((state) => state.removeRunningTerminalBySessionId);

  // On mount: sync running terminals from backend
  useEffect(() => {
    async function sync() {
      try {
        const sessions: { sessionId: string; versionId: number }[] = await invoke('list_active_terminals');
        syncRunningTerminals(sessions);
      } catch (err) {
        console.error('Failed to sync running terminals:', err);
      }
    }
    sync();
  }, [syncRunningTerminals]);

  // Global listener for terminal-exit events (handles background terminal exits)
  useEffect(() => {
    const unlisten = listen<string>('terminal-exit', (event) => {
      const sessionId = event.payload;
      // Remove from running terminals tracking
      removeRunningTerminalBySessionId(sessionId);
    });

    return () => {
      unlisten.then((u) => u());
    };
  }, [removeRunningTerminalBySessionId]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      <DevBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-auto">
              {children}
            </main>
          </div>
        </div>
        <DownloadPanel />
      </div>
    </div>
  );
}
