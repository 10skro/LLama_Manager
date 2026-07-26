import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { X, Grid, LayoutList } from 'lucide-react';
import { useTerminalSessions } from '@/hooks/useTerminalSessions';
import { TerminalSessionList } from './TerminalSessionList';
import { TerminalSessionGrid } from './TerminalSessionGrid';
import { TerminalSessionItem } from './TerminalSessionItem';

type ViewMode = 'list' | 'grid';

export function TerminalWidget() {
  // Theme is already applied by theme-init.js (synchronous during HTML parse).
  // No need for useTheme() here — the terminal window has no theme switching controls,
  // and calling useTheme() would trigger applyTheme() which causes unnecessary re-renders
  // and premature removal of the anti-flash style.

  const { sessions, refreshSessions } = useTerminalSessions();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  // Use useRef to track selectedId to avoid re-render cascade on mount:
  // sessions=[] → sessions=[...] → selectedId=null → selectedId=first
  // With useRef, we only trigger a re-render when the user explicitly changes selection.
  const selectedIdRef = useRef<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Auto-select first session when sessions arrive (fixes null selectedId on mount)
  // Uses useRef to avoid re-render when auto-selecting on mount
  useEffect(() => {
    if (sessions.length > 0) {
      const current = selectedIdRef.current;
      if (!current || !sessions.some((s) => s.sessionId === current)) {
        const newId = sessions[0].sessionId;
        selectedIdRef.current = newId;
        setSelectedId(newId);
      }
    }
  }, [sessions]);

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
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-sidebar">
        <span className="text-sm font-semibold text-foreground/80">Terminals</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'list' ? 'bg-primary/20 text-foreground' : 'text-foreground/40 hover:text-foreground/70'
            }`}
            title="List view"
          >
            <LayoutList className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'grid' ? 'bg-primary/20 text-foreground' : 'text-foreground/40 hover:text-foreground/70'
            }`}
            title="Grid view"
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            onClick={handleCloseWindow}
            className="p-1.5 rounded transition-colors text-foreground/40 hover:text-foreground/70 hover:bg-foreground/10"
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
