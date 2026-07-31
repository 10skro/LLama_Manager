import { create } from 'zustand';
import type { BuildFilters, AppSettings, CustomCommand, TerminalSession, ServerStatus } from '@/types';
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

  // Unified terminal session tracking (version_id -> TerminalSession)
  // Each version card gets its own independent session, even if sharing the same config.
  // Status transitions are enforced by serverStatusMachine (stopped → running → stopping → stopped).
  terminalSessions: Record<number, TerminalSession>;
  updateTerminalStatus: (versionId: number, status: ServerStatus, sessionId?: string) => void;
  clearTerminalSession: (versionId: number) => void;
  syncTerminalSessions: (sessions: { sessionId: string; versionId: number }[]) => void;
  removeTerminalBySessionId: (sessionId: string) => void;
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

  // Unified terminal session tracking (version_id -> TerminalSession)
  terminalSessions: {},
  updateTerminalStatus: (versionId, status, sessionId) =>
    set((state) => {
      const existing = state.terminalSessions[versionId];
      const sid = sessionId ?? existing?.sessionId;
      if (!sid) return {};
      return {
        terminalSessions: { ...state.terminalSessions, [versionId]: { sessionId: sid, status } },
      };
    }),
  clearTerminalSession: (versionId) =>
    set((state) => {
      const next = { ...state.terminalSessions };
      delete next[versionId];
      return { terminalSessions: next };
    }),
  syncTerminalSessions: (sessions) =>
    set(() => {
      const map: Record<number, TerminalSession> = {};
      for (const s of sessions) {
        map[s.versionId] = { sessionId: s.sessionId, status: 'running' };
      }
      return { terminalSessions: map };
    }),
  removeTerminalBySessionId: (sessionId) =>
    set((state) => {
      const next = { ...state.terminalSessions };
      for (const [versionIdStr, session] of Object.entries(next)) {
        if (session.sessionId === sessionId) {
          delete next[Number(versionIdStr)];
          break;
        }
      }
      return { terminalSessions: next };
    }),
}));

// Computed helpers (use directly in components)
export function useGetTerminalSession(versionId: number): TerminalSession | undefined {
  const terminalSessions = useAppStore((s) => s.terminalSessions);
  return terminalSessions[versionId];
}
