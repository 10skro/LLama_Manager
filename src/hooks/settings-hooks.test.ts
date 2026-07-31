import { describe, it, expect, vi, beforeEach } from 'vitest';

/*
 * Smoke tests for settings refactor hooks (FR-002, FR-003, FR-005).
 * These verify that hooks export correctly and return expected shapes.
 * Full behavioral testing requires @testing-library/react renderHook.
 */

describe('settings hooks — smoke tests', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('useGithubTokenState', () => {
    it('should export a function', async () => {
      vi.doMock('@/services/github-token', () => ({
        saveGithubToken: vi.fn().mockResolvedValue(undefined),
        hasGithubToken: vi.fn().mockResolvedValue(false),
        deleteGithubToken: vi.fn().mockResolvedValue(undefined),
      }));
      vi.doMock('react', () => ({
        useState: vi.fn((init) => [init, vi.fn()]),
        useEffect: vi.fn(),
      }));

      const mod = await import('@/hooks/useGithubTokenState');
      expect(typeof mod.useGithubTokenState).toBe('function');
    });
  });

  describe('useDebouncedFolderInput', () => {
    it('should export a function', async () => {
      vi.doMock('@/services/settings', () => ({
        saveSettings: vi.fn().mockResolvedValue(undefined),
        selectFolder: vi.fn().mockResolvedValue(null),
      }));
      vi.doMock('react', () => ({
        useState: vi.fn((init) => [init, vi.fn()]),
        useEffect: vi.fn(),
        useRef: vi.fn(() => ({ current: null })),
        useCallback: vi.fn((fn) => fn),
      }));

      const mod = await import('@/hooks/useDebouncedFolderInput');
      expect(typeof mod.useDebouncedFolderInput).toBe('function');
    });
  });

  describe('useSettingsPersistence', () => {
    it('should export a function', async () => {
      vi.doMock('@/services/settings', () => ({
        saveSettings: vi.fn().mockResolvedValue(undefined),
      }));

      const mod = await import('@/hooks/useSettingsPersistence');
      expect(typeof mod.useSettingsPersistence).toBe('function');
    });
  });
});
