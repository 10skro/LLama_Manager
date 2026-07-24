import { create } from 'zustand';
import type { BuildFilters, AppSettings, LaunchConfig, CustomCommand } from '@/types';
import { DEFAULT_THEME_ID } from '@/themes';
import { makeKey } from '@/utils/buildKey';

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

  // Launch Configs
  launchConfigs: LaunchConfig[];
  setLaunchConfigs: (configs: LaunchConfig[]) => void;
  addLaunchConfig: (config: LaunchConfig) => void;
  removeLaunchConfig: (id: string) => void;
  updateLaunchConfig: (config: LaunchConfig) => void;

  // Custom Commands
  customCommands: CustomCommand[];
  setCustomCommands: (commands: CustomCommand[]) => void;
  addCustomCommand: (command: CustomCommand) => void;
  removeCustomCommand: (id: string) => void;
  updateCustomCommand: (command: CustomCommand) => void;

  // Terminal
  terminalVisible: boolean;
  setTerminalVisible: (visible: boolean) => void;
  activeTerminalId: string | null;
  setActiveTerminalId: (id: string | null) => void;
  toggleTerminal: () => void;
  resetTerminal: () => void;
}

const defaultSettings: AppSettings = {
  storage_path: '',
  theme: DEFAULT_THEME_ID,
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
  activeTheme: DEFAULT_THEME_ID,
  setActiveTheme: (themeId: string) => set({ activeTheme: themeId }),

  // UI
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  // Launch Configs
  launchConfigs: [],
  setLaunchConfigs: (configs) => set({ launchConfigs: configs }),
  addLaunchConfig: (config) =>
    set((state) => ({ launchConfigs: [...state.launchConfigs, config] })),
  removeLaunchConfig: (id) =>
    set((state) => ({
      launchConfigs: state.launchConfigs.filter((c) => c.id !== id),
    })),
  updateLaunchConfig: (config) =>
    set((state) => ({
      launchConfigs: state.launchConfigs.map((c) =>
        c.id === config.id ? config : c
      ),
    })),

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

  // Terminal
  terminalVisible: false,
  setTerminalVisible: (visible) => set({ terminalVisible: visible }),
  activeTerminalId: null,
  setActiveTerminalId: (id) => set({ activeTerminalId: id }),
  toggleTerminal: () =>
    set((state) => ({ terminalVisible: !state.terminalVisible })),
  resetTerminal: () =>
    set({ terminalVisible: false, activeTerminalId: null }),
}));