import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { X, Grid, LayoutList } from 'lucide-react';
import { useTerminalSessions } from '@/hooks/useTerminalSessions';
import { TerminalSessionList } from './TerminalSessionList';
import { TerminalSessionGrid } from './TerminalSessionGrid';
import { TerminalSessionItem } from './TerminalSessionItem';
import { useTheme } from '@/hooks/useTheme';

type ViewMode = 'list' | 'grid';

export function TerminalWidget() {
  // Apply theme reactively — reads from Zustand store hydrated by __INITIAL_THEME__
  useTheme();

  const { sessions, refreshSessions } = useTerminalSessions();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Auto-select first session when sessions arrive (fixes null selectedId on mount)
  useEffect(() => {
    if (sessions.length > 0 && !sessions.some((s) => s.sessionId === selectedId)) {
      setSelectedId(sessions[0].sessionId);
    }
  }, [sessions, selectedId]);

  const handleClose = async (sessionId: string) => {
    await invoke('kill_terminal', { sessionId }).catch((err) => {
      console.error('Failed to kill terminal:', err);
    });
    await refreshSessions();
  };

  const selectedSession = sessions.find((s) => s.sessionId === selectedId);

  const handleCloseWindow = () => {
    getCurrentWebviewWindow().close();
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/10 bg-sidebar">
        <span className="text-sm font-semibold text-foreground/80">Terminals</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'list' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'
            }`}
            title="List view"
          >
            <LayoutList className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'grid' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'
            }`}
            title="Grid view"
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            onClick={handleCloseWindow}
            className="p-1.5 rounded transition-colors text-white/40 hover:text-white/70 hover:bg-white/15"
            title="Close window"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* List view: sidebar + single terminal */}
        {viewMode === 'list' && (
          <>
            <div className="w-48 flex-shrink-0 overflow-hidden">
              <TerminalSessionList
                sessions={sessions}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
            <div className="flex-1 overflow-hidden">
              {selectedSession ? (
                <TerminalSessionItem
                  sessionId={selectedSession.sessionId}
                  versionId={selectedSession.versionId}
                  configId={selectedSession.configId}
                  onClose={handleClose}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-foreground/30">Sélectionnez une session</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Grid view: all terminals side by side */}
        {viewMode === 'grid' && (
          <div className="flex-1 overflow-hidden">
            <TerminalSessionGrid sessions={sessions} onClose={handleClose} />
          </div>
        )}
      </div>
    </div>
  );
}
