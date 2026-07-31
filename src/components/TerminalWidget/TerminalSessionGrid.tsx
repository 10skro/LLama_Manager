import { TerminalSessionItem } from './TerminalSessionItem';
import type { TerminalSession } from '@/hooks/Terminal/useTerminalSessions';

interface TerminalSessionGridProps {
  sessions: TerminalSession[];
  cardTitleMap: Record<number, string>;
  onClose: (sessionId: string) => void;
}

export function TerminalSessionGrid({ sessions, cardTitleMap, onClose }: TerminalSessionGridProps) {
  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 p-4 bg-background">
        <p className="text-sm text-foreground/30 text-center">Aucun terminal actif</p>
      </div>
    );
  }

  const cols = sessions.length >= 3 ? 3 : sessions.length;
  const rows = Math.ceil(sessions.length / cols);

  return (
    <div
      className="flex-1 grid gap-1 p-1 bg-background overflow-hidden"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {sessions.map((session) => (
        <div
          key={session.sessionId}
          className="flex flex-col min-h-0 rounded overflow-hidden border border-border/10"
        >
          <TerminalSessionItem
            sessionId={session.sessionId}
            versionId={session.versionId}
            configId={session.configId}
            cardTitle={cardTitleMap[session.versionId] || ''}
            onClose={onClose}
          />
        </div>
      ))}
    </div>
  );
}
