import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { DownloadPanel } from '@/components/Download/DownloadPanel';
import { EmbeddedTerminal } from '@/components/Terminal/EmbeddedTerminal';
import { useAppStore } from '@/store/useAppStore';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { terminalVisible, activeTerminalId } = useAppStore();
  const syncRunningTerminals = useAppStore((state) => state.syncRunningTerminals);
  const removeRunningTerminalBySessionId = useAppStore((state) => state.removeRunningTerminalBySessionId);
  const resetTerminal = useAppStore((state) => state.resetTerminal);

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
      console.log('[APP] terminal-exit event for session:', sessionId);

      // Remove from running terminals tracking
      removeRunningTerminalBySessionId(sessionId);

      // If the exited session was the active terminal, reset the panel
      if (activeTerminalId === sessionId) {
        resetTerminal();
      }
    });

    return () => {
      unlisten.then((u) => u());
    };
  }, [activeTerminalId, removeRunningTerminalBySessionId, resetTerminal]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
        {/* Terminal Panel - kept mounted to preserve process when toggled */}
        {activeTerminalId && (
          <div
            className={`border-t border-border/50 flex flex-col transition-all duration-200 ${
              terminalVisible ? 'min-h-32 max-h-[50vh] h-72' : 'h-0 min-h-0 overflow-hidden'
            }`}
          >
            <EmbeddedTerminal
              sessionId={activeTerminalId}
              onClose={() => {}}
            />
          </div>
        )}
      </div>
      <DownloadPanel />
    </div>
  );
}
