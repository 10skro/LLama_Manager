import type { ServerStatus } from '@/types';

// Allowed transitions between server statuses.
// Adding a new status: add an entry here defining valid outgoing transitions.
const transitions: Record<ServerStatus, ServerStatus[]> = {
  stopped: ['starting'],
  starting: ['running', 'error'],
  running: ['stopping', 'error'],
  stopping: ['stopped'],
  error: ['stopped'],
};

/**
 * Check if a transition from `from` to `to` is allowed by the state machine.
 */
export function canTransition(from: ServerStatus, to: ServerStatus): boolean {
  return transitions[from]?.includes(to) ?? false;
}

/**
 * Return all defined server statuses.
 * Useful for iteration and validation.
 */
export function getAllStatuses(): ServerStatus[] {
  return Object.keys(transitions) as ServerStatus[];
}
