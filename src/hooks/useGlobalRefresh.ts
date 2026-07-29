import { useCallback } from 'react';
import { useRefreshStore, startCountdown } from '@/store/useRefreshStore';
import { getCatalogLastFetched } from '@/services/github';

export function useGlobalRefresh() {
  const { isRefreshing, secondsLeft, lastFetched, begin, end, setLastFetched } = useRefreshStore();

  const canRefresh = secondsLeft === 0 && !isRefreshing;

  const refresh = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      if (isRefreshing) throw new Error('Already refreshing');
      if (secondsLeft > 0) throw new Error('Cooldown active');

      begin();
      try {
        const result = await fn();
        const ts = await getCatalogLastFetched();
        setLastFetched(ts);
        end(true);
        startCountdown();
        return result;
      } catch (err) {
        end(false);
        throw err;
      }
    },
    [isRefreshing, secondsLeft, begin, end, setLastFetched]
  );

  return { canRefresh, isRefreshing, secondsLeft, lastFetched, refresh };
}
