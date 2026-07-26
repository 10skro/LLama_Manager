import { create } from 'zustand';
import type { BuildFilters, AppSettings, CustomCommand } from '@/types';
import { DEFAULT_THEME_ID, getThemeById } from '@/themes';
import { makeKey } from '@/utils/buildKey';

/**
 * Hydrate the initial theme from Rust-injected __INITIAL_THEME__.
 * This value is set by the backend via initialization_script() before
 * the HTML is parsed, so it's available synchronously at module load time.
 * Falls back to DEFAULT_THEME_ID if not available.
 */
function getInitialTheme(): string {
  const injected = (window as any).__INITIAL_THEME__;
  if (injected && injected.name) {
    // Validate the theme ID exists in our theme registry
    const theme = getThemeById(injected.name);
    if (theme) {
      return injected.name;
    }
  }
  return DEFAULT_THEME_ID;
}

interface ActiveDownloadInfo {
  id: number;
  progress: number;
  status: 'pending' | 'downloading' | 'downloaded' | 'extracting' | 'completed' | 'failed' | 'cancelled';
}

interface AppState {
  // Sidebar
  activeRoute: string;
  setActiveRoute: (route: string) => void;

  // Filters
  filters: BuildFilters;
  setFilters: (filters: Partial<BuildFilters>) => void;

  // Downloads
  activeDownloads: Map<string, ActiveDownloadInfo>; // composite key "build_number|backend|architecture" -> {id, progress, status}
  downloadingKeys: Set<string>; // only keys with status 'downloading' or 'extracting' (stable reference during progress ticks)
  updateDownloadProgress: (buildNumber: string, backend: string, architecture: string, progress: number, downloadId?: number, status?: 'pending' | 'downloading' | 'downloaded' | 'extracting' | 'completed' | 'failed' | 'cancelled') => void;
  clearDownload: (buildNumber: string, backend: string, architecture: string) => void;
  getDownloadId: (buildNumber: string, backend: string, architecture: string) => number | undefined;

  // Settings
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;

  // Notifications
  newBuilds: string[];
  setNewBuilds: (builds: string[]) => void;
  dismissNewBuild: (build: string) => void;

  // Theme
  activeTheme: string;
  setActiveTheme: (themeId: string) => void;

  // UI
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Custom Commands
  customCommands: CustomCommand[];
  setCustomCommands: (commands: CustomCommand[]) => void;
  addCustomCommand: (command: CustomCommand) => void;
  removeCustomCommand: (id: string) => void;
  updateCustomCommand: (command: CustomCommand) => void;

  // Running terminals tracking (version_id -> session_id)
  // Each version card gets its own independent session, even if sharing the same config.
  runningTerminals: Record<number, string>;
  setRunningTerminal: (versionId: number, sessionId: string) => void;
  removeRunningTerminal: (versionId: number) => void;
  removeRunningTerminalBySessionId: (sessionId: string) => void;
  isTerminalRunning: (versionId: number) => boolean;
  getRunningSessionId: (versionId: number) => string | undefined;
  syncRunningTerminals: (sessions: { sessionId: string; versionId: number }[]) => void;
}

const initialTheme = getInitialTheme();

const defaultSettings: AppSettings = {
  storage_path: '',
  theme: initialTheme,
  auto_check_updates: true,
  toast_duration: 5000,
};

const defaultFilters: BuildFilters = {
  search: '',
  backend: [],
  architecture: '',
  sortBy: 'date',
  sortOrder: 'desc',
  favoritesOnly: false,
  installedOnly: false,
};

export const useAppStore = create<AppState>((set, get) => ({
  // Sidebar
  activeRoute: '/',
  setActiveRoute: (route) => set({ activeRoute: route }),

  // Filters
  filters: defaultFilters,
  setFilters: (partial) =>
    set((state) => ({ filters: { ...state.filters, ...partial } })),

  // Downloads
  activeDownloads: new Map(),
  downloadingKeys: new Set(),
  updateDownloadProgress: (buildNumber, backend, architecture, progress, downloadId, status) =>
    set((state) => {
      const key = makeKey(buildNumber, backend, architecture);
      const existing = state.activeDownloads.get(key);
      const newStatus = status ?? existing?.status ?? 'downloading';

      // Skip if progress and status are identical (prevents unnecessary re-renders)
      if (existing && existing.progress === progress && existing.status === newStatus) {
        return {};
      }

      const wasDownloading = existing?.status === 'downloading' || existing?.status === 'extracting';
      const isNowDownloading = newStatus === 'downloading' || newStatus === 'extracting';

      // Only update downloadingKeys if the downloading state changed
      let newDownloadingKeys = state.downloadingKeys;
      if (isNowDownloading && !wasDownloading) {
        newDownloadingKeys = new Set(state.downloadingKeys);
        newDownloadingKeys.add(key);
      } else if (!isNowDownloading && wasDownloading) {
        newDownloadingKeys = new Set(state.downloadingKeys);
        newDownloadingKeys.delete(key);
      }

      const next = new Map(state.activeDownloads);
      next.set(key, {
        id: downloadId ?? existing?.id ?? 0,
        progress,
        status: newStatus,
      });
      return { activeDownloads: next, downloadingKeys: newDownloadingKeys };
    }),
  clearDownload: (buildNumber, backend, architecture) =>
    set((state) => {
      const key = makeKey(buildNumber, backend, architecture);
      const next = new Map(state.activeDownloads);
      next.delete(key);
      const newDownloadingKeys = new Set(state.downloadingKeys);
      newDownloadingKeys.delete(key);
      return { activeDownloads: next, downloadingKeys: newDownloadingKeys };
    }),
  // Used by DownloadPanel for progress matching
  getDownloadId: (buildNumber, backend, architecture) => {
    const key = makeKey(buildNumber, backend, architecture);
    return get().activeDownloads.get(key)?.id;
  },

  // Settings
  settings: defaultSettings,
  setSettings: (settings) => set({ settings }),

  // Notifications
  newBuilds: [],
  setNewBuilds: (builds) => set({ newBuilds: builds }),
  dismissNewBuild: (build) =>
    set((state) => ({
      newBuilds: state.newBuilds.filter((b) => b !== build),
    })),

  // Theme
  activeTheme: initialTheme,
  setActiveTheme: (themeId: string) =>
    set((state) => {
      // Skip if theme hasn't actually changed (prevents unnecessary re-renders)
      if (state.activeTheme === themeId) {
        return {};
      }
      return { activeTheme: themeId };
    }),

  // UI
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  // Custom Commands
  customCommands: [],
  setCustomCommands: (commands) => set({ customCommands: commands }),
  addCustomCommand: (command) =>
    set((state) => ({ customCommands: [...state.customCommands, command] })),
  removeCustomCommand: (id) =>
    set((state) => ({
      customCommands: state.customCommands.filter((c) => c.id !== id),
    })),
  updateCustomCommand: (command) =>
    set((state) => ({
      customCommands: state.customCommands.map((c) =>
        c.id === command.id ? command : c
      ),
    })),

  // Running terminals tracking (version_id -> session_id)
  runningTerminals: {},
  setRunningTerminal: (versionId, sessionId) =>
    set((state) => ({
      runningTerminals: { ...state.runningTerminals, [versionId]: sessionId },
    })),
  removeRunningTerminal: (versionId) =>
    set((state) => {
      const next = { ...state.runningTerminals };
      delete next[versionId];
      return { runningTerminals: next };
    }),
  removeRunningTerminalBySessionId: (sessionId) =>
    set((state) => {
      const next = { ...state.runningTerminals };
      for (const [versionIdStr, sid] of Object.entries(next)) {
        if (sid === sessionId) {
          delete next[Number(versionIdStr)];
          break;
        }
      }
      return { runningTerminals: next };
    }),
  isTerminalRunning: () => false, // computed in getter below
  getRunningSessionId: () => undefined, // computed in getter below
  syncRunningTerminals: (sessions) =>
    set(() => {
      const map: Record<number, string> = {};
      for (const s of sessions) {
        map[s.versionId] = s.sessionId;
      }
      return { runningTerminals: map };
    }),
}));

// Computed helpers (use directly in components)
export function useIsTerminalRunning(versionId: number): boolean {
  const runningTerminals = useAppStore((s) => s.runningTerminals);
  return versionId in runningTerminals;
}

export function useGetRunningSessionId(versionId: number): string | undefined {
  const runningTerminals = useAppStore((s) => s.runningTerminals);
  return runningTerminals[versionId];
}