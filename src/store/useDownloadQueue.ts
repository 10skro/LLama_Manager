import { create } from 'zustand';
import type { Build } from '@/types';

interface QueuedDownload {
  build: Build;
  addedAt: number;
}

interface DownloadQueueState {
  // Queue of builds waiting to be downloaded
  queue: QueuedDownload[];
  // Currently downloading build (null = idle)
  active: Build | null;

  // Add a build to the queue or start it immediately if idle
  enqueue: (build: Build) => void;

  // Remove a specific build from the queue
  removeFromQueue: (buildNumber: string, backend: string) => void;

  // Clear the entire queue
  clearQueue: () => void;

  // Mark current download as done and start next in queue
  completeActive: () => QueuedDownload | null;

  // Check if a specific build is already downloading or queued
  isBusy: (buildNumber: string, backend: string) => boolean;

  // Get queue position for a build (1-based, 0 = actively downloading, -1 = not in queue)
  getQueuePosition: (buildNumber: string, backend: string) => number;
}

export const useDownloadQueue = create<DownloadQueueState>((set, get) => ({
  queue: [],
  active: null,

  enqueue: (build) => {
    const { active, queue, isBusy } = get();
    // Don't duplicate if already active or queued
    if (isBusy(build.build_number, build.backend)) {
      return;
    }

    const entry = { build, addedAt: Date.now() };

    if (!active) {
      // No active download — start immediately
      set({ active: build });
      // Trigger the actual download via callback (handled by the consumer)
    } else {
      // Add to queue
      set({ queue: [...queue, entry] });
    }
  },

  removeFromQueue: (buildNumber, backend) => {
    set({
      queue: get().queue.filter(
        q => !(q.build.build_number === buildNumber && q.build.backend === backend)
      ),
    });
  },

  clearQueue: () => {
    set({ queue: [] });
  },

  completeActive: () => {
    const { queue, active } = get();
    if (!active) return null;

    set({ active: null });

    if (queue.length > 0) {
      const next = queue[0];
      set({ queue: queue.slice(1) });
      return next;
    }
    return null;
  },

  isBusy: (buildNumber, backend) => {
    const { active, queue } = get();
    if (active && active.build_number === buildNumber && active.backend === backend) {
      return true;
    }
    return queue.some(q => q.build.build_number === buildNumber && q.build.backend === backend);
  },

  getQueuePosition: (buildNumber, backend) => {
    const { active, queue } = get();
    if (active && active.build_number === buildNumber && active.backend === backend) {
      return 0; // Actively downloading
    }
    const idx = queue.findIndex(q => q.build.build_number === buildNumber && q.build.backend === backend);
    return idx >= 0 ? idx + 1 : -1; // 1-based position
  },
}));
