import { useGetTerminalSession } from '@/store/useAppStore';
import type { ServerStatus } from '@/types';
import { canTransition } from '@/services/serverStatusMachine';

/**
 * Reactive hook that exposes the current server status for a given version.
 * Provides transition validation via the state machine.
 */
export function useServerStatus(versionId: number) {
  const session = useGetTerminalSession(versionId);
  const status: ServerStatus = session?.status ?? 'stopped';

  return {
    status,
    sessionId: session?.sessionId,
    canTransitionTo: (to: ServerStatus) => canTransition(status, to),
  };
}
