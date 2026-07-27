import type { TerminalSession } from '@/hooks/useTerminalSessions';

interface TerminalSessionListProps {
  sessions: TerminalSession[];
  selectedId: string | null;
  onSelect: (sessionId: string) => void;
  cardTitleMap: Record<number, string>;
}

export function TerminalSessionList({ sessions, selectedId, onSelect, cardTitleMap }: TerminalSessionListProps) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col h-full bg-sidebar border-r border-border/10">
        <div className="px-3 py-2 border-b border-border/10">
          <span className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">Sessions</span>
        </div>
        <div className="flex items-center justify-center flex-1 p-4">
          <p className="text-sm text-foreground/30 text-center">Aucun terminal actif</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-border/10">
      <div className="px-3 py-2 border-b border-border/10">
        <span className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">Sessions ({sessions.length})</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sessions.map((session) => (
          <button
            key={session.sessionId}
            onClick={() => onSelect(session.sessionId)}
            className={`w-full text-left px-3 py-2 border-b border-border/5 transition-colors flex items-center justify-between gap-2 ${
              selectedId === session.sessionId
                ? 'bg-primary/15 text-foreground'
                : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground/80'
            }`}
          >
            <span className="text-xs font-mono truncate">{session.sessionId.slice(0, 8)}</span>
            {cardTitleMap[session.versionId] && (
              <span className="text-xs text-foreground/50 truncate flex-1 min-w-0 ml-1">— {cardTitleMap[session.versionId]}</span>
            )}
            <span className="text-xs text-foreground/30 flex-shrink-0">v{session.versionId}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
