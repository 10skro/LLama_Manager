import { create } from 'zustand';

interface RefreshState {
  isRefreshing: boolean;
  secondsLeft: number;
  lastFetched: string | null;
  begin: () => void;
  end: (success: boolean) => void;
  setLastFetched: (ts: string | null) => void;
}

const COOLDOWN_SECONDS = 30;

export const useRefreshStore = create<RefreshState>((set) => ({
  isRefreshing: false,
  secondsLeft: 0,
  lastFetched: null,
  begin: () => set({ isRefreshing: true }),
  end: (success) => set({ isRefreshing: false, secondsLeft: success ? COOLDOWN_SECONDS : 0 }),
  setLastFetched: (ts) => set({ lastFetched: ts }),
}));

let countdownInterval: ReturnType<typeof setInterval>;

export function startCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  countdownInterval = setInterval(() => {
    useRefreshStore.setState((prev) => {
      if (prev.secondsLeft <= 1) {
        clearInterval(countdownInterval);
        return { secondsLeft: 0 };
      }
      return { secondsLeft: prev.secondsLeft - 1 };
    });
  }, 1000);
}