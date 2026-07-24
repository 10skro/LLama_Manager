import type { ReactNode } from 'react';
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
