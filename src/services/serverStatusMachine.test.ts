import { describe, it, expect } from 'vitest';
import { canTransition, getAllStatuses } from '../services/serverStatusMachine';

describe('serverStatusMachine', () => {
  describe('canTransition — allowed transitions', () => {
    it('should allow stopped -> starting', () => {
      expect(canTransition('stopped', 'starting')).toBe(true);
    });

    it('should allow starting -> running', () => {
      expect(canTransition('starting', 'running')).toBe(true);
    });

    it('should allow starting -> error (crash during startup)', () => {
      expect(canTransition('starting', 'error')).toBe(true);
    });

    it('should allow running -> stopping', () => {
      expect(canTransition('running', 'stopping')).toBe(true);
    });

    it('should allow running -> error (crash during execution)', () => {
      expect(canTransition('running', 'error')).toBe(true);
    });

    it('should allow stopping -> stopped', () => {
      expect(canTransition('stopping', 'stopped')).toBe(true);
    });

    it('should allow error -> stopped (user resets after error)', () => {
      expect(canTransition('error', 'stopped')).toBe(true);
    });
  });

  describe('canTransition — disallowed transitions', () => {
    it('should disallow stopped -> running (must go through starting)', () => {
      expect(canTransition('stopped', 'running')).toBe(false);
    });

    it('should disallow stopped -> stopping', () => {
      expect(canTransition('stopped', 'stopping')).toBe(false);
    });

    it('should disallow stopped -> error', () => {
      expect(canTransition('stopped', 'error')).toBe(false);
    });

    it('should disallow stopped -> stopped', () => {
      expect(canTransition('stopped', 'stopped')).toBe(false);
    });

    it('should disallow starting -> stopped (must resolve first)', () => {
      expect(canTransition('starting', 'stopped')).toBe(false);
    });

    it('should disallow running -> running', () => {
      expect(canTransition('running', 'running')).toBe(false);
    });

    it('should disallow running -> stopped (must go through stopping)', () => {
      expect(canTransition('running', 'stopped')).toBe(false);
    });

    it('should disallow stopping -> running', () => {
      expect(canTransition('stopping', 'running')).toBe(false);
    });

    it('should disallow stopping -> stopping', () => {
      expect(canTransition('stopping', 'stopping')).toBe(false);
    });

    it('should disallow error -> running (must reset to stopped first)', () => {
      expect(canTransition('error', 'running')).toBe(false);
    });

    it('should disallow error -> starting', () => {
      expect(canTransition('error', 'starting')).toBe(false);
    });
  });

  describe('getAllStatuses', () => {
    it('should return all defined statuses', () => {
      const statuses = getAllStatuses();
      expect(statuses).toContain('stopped');
      expect(statuses).toContain('starting');
      expect(statuses).toContain('running');
      expect(statuses).toContain('stopping');
      expect(statuses).toContain('error');
      expect(statuses.length).toBe(5);
    });
  });
});
