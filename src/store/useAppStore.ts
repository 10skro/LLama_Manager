import { create } from 'zustand';
import type { BuildFilters, AppSettings } from '@/types';
import { DEFAULT_THEME_ID } from '@/themes';

interface ActiveDownloadInfo {
  id: number;
  progress: number;
  status: 'pending' | 'downloading' | 'downloaded' | 'extracting' | 'completed' | 'failed' | 'cancelled';
}

// Helper to create composite key
export function makeKey(buildNumber: string, backend: string): string {
  return `${buildNumber}|${backend}`;
}

interface AppState {
  // Sidebar
  activeRoute: string;
  setActiveRoute: (route: string) => void;

  // Filters
  filters: BuildFilters;
  setFilters: (filters: Partial<BuildFilters>) => void;

  // Downloads
  activeDownloads: Map<string, ActiveDownloadInfo>; // composite key "build_number|backend" -> {id, progress, status}
  downloadingKeys: Set<string>; // only keys with status 'downloading' or 'extracting' (stable reference during progress ticks)
  updateDownloadProgress: (buildNumber: string, backend: string, progress: number, downloadId?: number, status?: 'pending' | 'downloading' | 'downloaded' | 'extracting' | 'completed' | 'failed' | 'cancelled') => void;
  clearDownload: (buildNumber: string, backend: string) => void;
  getDownloadId: (buildNumber: string, backend: string) => number | undefined;

  // Settings
  settings: AppSettings | null;
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
}

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
  updateDownloadProgress: (buildNumber, backend, progress, downloadId, status) =>
    set((state) => {
      const key = makeKey(buildNumber, backend);
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
  clearDownload: (buildNumber, backend) =>
    set((state) => {
      const key = makeKey(buildNumber, backend);
      const next = new Map(state.activeDownloads);
      next.delete(key);
      const newDownloadingKeys = new Set(state.downloadingKeys);
      newDownloadingKeys.delete(key);
      return { activeDownloads: next, downloadingKeys: newDownloadingKeys };
    }),
  // Used by DownloadPanel for progress matching
  getDownloadId: (buildNumber, backend) => {
    const key = makeKey(buildNumber, backend);
    return get().activeDownloads.get(key)?.id;
  },

  // Settings
  settings: null,
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
}));