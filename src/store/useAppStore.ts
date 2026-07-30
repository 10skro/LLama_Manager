import { create } from 'zustand';
import type { BuildFilters, AppSettings, CustomCommand } from '@/types';
import { DEFAULT_THEME_ID } from '@/themes';
import { makeKey } from '@/utils/buildKey';

/**
 * Read the theme injected by the Tauri backend via initialization_script.
 * This runs at module load time, right after the backend has set
 * window.__INITIAL_THEME__ in the WebView. Using this value as the store
 * default eliminates the theme thrashing caused by the store starting with
 * a hardcoded default that differs from the saved theme.
 */
function getBootTheme(): string {
  // @ts-expect-error — window.__INITIAL_THEME__ is set by Tauri initialization_script
  return (typeof window.__INITIAL_THEME__ === 'string' && window.__INITIAL_THEME__)
    ? // @ts-expect-error — window.__INITIAL_THEME__ is set by Tauri initialization_script
      window.__INITIAL_THEME__
    : DEFAULT_THEME_ID;
}

interface ActiveDownloadInfo {
  id: number;
  progress: number;
  status:
    'pending' | 'downloading' | 'downloaded' | 'extracting' | 'completed' | 'failed' | 'cancelled';
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
  updateDownloadProgress: (
    buildNumber: string,
    backend: string,
    architecture: string,
    progress: number,
    downloadId?: number,
    status?:
      'pending' | 'downloading' | 'downloaded' | 'extracting' | 'completed' | 'failed' | 'cancelled'
  ) => void;
  clearDownload: (buildNumber: string, backend: string, architecture: string) => void;
  getDownloadId: (buildNumber: string, backend: string, architecture: string) => number | undefined;

  // Settings
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;

  // App Update
  appUpdateAvailable: boolean;
  appUpdateVersion: string | null;
  appUpdateDate: string | null;
  appUpdateBody: string | null;
  appUpdateLastChecked: string | null;
  setAppUpdate: (info: {
    available: boolean;
    version: string | null;
    date: string | null;
    body: string | null;
  }) => void;

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
  syncRunningTerminals: (sessions: { sessionId: string; versionId: number }[]) => void;

  // Stopping terminals tracking (version_id -> session_id)
  // Set when kill is initiated, cleared when terminal-exit event fires.
  stoppingTerminals: Record<number, string>;
  setStoppingTerminal: (versionId: number, sessionId: string) => void;
  removeStoppingTerminal: (versionId: number) => void;
}

const defaultSettings: AppSettings = {
  storage_path: '',
  theme: DEFAULT_THEME_ID,
  auto_check_updates: true,
  show_update_modal: true,
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
  setFilters: (partial) => set((state) => ({ filters: { ...state.filters, ...partial } })),

  // App Update
  appUpdateAvailable: false,
  appUpdateVersion: null,
  appUpdateDate: null,
  appUpdateBody: null,
  appUpdateLastChecked: null,
  setAppUpdate: (info) =>
    set({
      appUpdateAvailable: info.available,
      appUpdateVersion: info.version,
      appUpdateDate: info.date,
      appUpdateBody: info.body,
      appUpdateLastChecked: new Date().toISOString(),
    }),

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

      const wasDownloading =
        existing?.status === 'downloading' || existing?.status === 'extracting';
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

  // Theme — hydrated from backend init script to avoid startup thrashing
  activeTheme: getBootTheme(),
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
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

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
      customCommands: state.customCommands.map((c) => (c.id === command.id ? command : c)),
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
  syncRunningTerminals: (sessions) =>
    set(() => {
      const map: Record<number, string> = {};
      for (const s of sessions) {
        map[s.versionId] = s.sessionId;
      }
      return { runningTerminals: map };
    }),

  // Stopping terminals tracking (version_id -> session_id)
  stoppingTerminals: {},
  setStoppingTerminal: (versionId, sessionId) =>
    set((state) => ({
      stoppingTerminals: { ...state.stoppingTerminals, [versionId]: sessionId },
    })),
  removeStoppingTerminal: (versionId) =>
    set((state) => {
      const next = { ...state.stoppingTerminals };
      delete next[versionId];
      return { stoppingTerminals: next };
    }),
}));

// Computed helpers (use directly in components)
export function useGetRunningSessionId(versionId: number): string | undefined {
  const runningTerminals = useAppStore((s) => s.runningTerminals);
  return runningTerminals[versionId];
}

export function useGetStoppingSessionId(versionId: number): string | undefined {
  const stoppingTerminals = useAppStore((s) => s.stoppingTerminals);
  return stoppingTerminals[versionId];
}
