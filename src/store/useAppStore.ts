import { create } from 'zustand';
import type { BuildFilters, AppSettings } from '@/types';
import { DEFAULT_THEME_ID } from '@/themes';

interface ActiveDownloadInfo {
  id: number;
  progress: number;
  status: 'downloading' | 'completed' | 'failed' | 'cancelled';
}

interface AppState {
  // Sidebar
  activeRoute: string;
  setActiveRoute: (route: string) => void;

  // Filters
  filters: BuildFilters;
  setFilters: (filters: Partial<BuildFilters>) => void;

  // Downloads
  activeDownloads: Map<string, ActiveDownloadInfo>; // build_number -> {id, progress}
  updateDownloadProgress: (build: string, progress: number, downloadId?: number, status?: 'downloading' | 'completed' | 'failed' | 'cancelled') => void;
  clearDownload: (build: string) => void;
  getDownloadId: (build: string) => number | undefined;

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
  updateDownloadProgress: (build, progress, downloadId, status) =>
    set((state) => {
      const next = new Map(state.activeDownloads);
      const existing = next.get(build);
      next.set(build, {
        id: downloadId ?? existing?.id ?? 0,
        progress,
        status: status ?? existing?.status ?? 'downloading',
      });
      return { activeDownloads: next };
    }),
  clearDownload: (build) =>
    set((state) => {
      const next = new Map(state.activeDownloads);
      next.delete(build);
      return { activeDownloads: next };
    }),
  getDownloadId: (build) => {
    return get().activeDownloads.get(build)?.id;
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
  setActiveTheme: (themeId) => set({ activeTheme: themeId }),

  // UI
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
