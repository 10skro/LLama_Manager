import { create } from 'zustand';
import type { BuildFilters, AppSettings } from '@/types';
import { DEFAULT_THEME_ID } from '@/themes';

interface ActiveDownloadInfo {
  id: number;
  progress: number;
  status: 'pending' | 'downloading' | 'extracting' | 'completed' | 'failed' | 'cancelled';
}

// Helper to create composite key
function makeKey(buildNumber: string, backend: string): string {
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
  updateDownloadProgress: (buildNumber: string, backend: string, progress: number, downloadId?: number, status?: 'pending' | 'downloading' | 'extracting' | 'completed' | 'failed' | 'cancelled') => void;
  clearDownload: (buildNumber: string, backend: string) => void;
  clearDownloadByBuildNumber: (buildNumber: string) => void;
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
  updateDownloadProgress: (buildNumber, backend, progress, downloadId, status) =>
    set((state) => {
      const key = makeKey(buildNumber, backend);
      const next = new Map(state.activeDownloads);
      const existing = next.get(key);
      next.set(key, {
        id: downloadId ?? existing?.id ?? 0,
        progress,
        status: status ?? existing?.status ?? 'downloading',
      });
      return { activeDownloads: next };
    }),
  clearDownload: (buildNumber, backend) =>
    set((state) => {
      const key = makeKey(buildNumber, backend);
      const next = new Map(state.activeDownloads);
      next.delete(key);
      return { activeDownloads: next };
    }),
  clearDownloadByBuildNumber: (buildNumber) =>
    set((state) => {
      const next = new Map(state.activeDownloads);
      for (const [key] of next.entries()) {
        if (key.startsWith(buildNumber + '|')) {
          next.delete(key);
          break;
        }
      }
      return { activeDownloads: next };
    }),
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