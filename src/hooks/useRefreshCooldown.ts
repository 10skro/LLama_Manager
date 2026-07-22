import { useState, useCallback, useEffect, useRef } from 'react';

interface UseRefreshCooldownOptions {
  cooldownMs?: number; // default 30000 (30s)
}

interface UseRefreshCooldownReturn<T = void> {
  canRefresh: boolean;
  isRefreshing: boolean;
  secondsLeft: number;
  refresh: () => Promise<T>;
  forceRefresh: () => Promise<T>;
}

export function useRefreshCooldown<T = void>(
  refreshFn: () => Promise<T>,
  options?: UseRefreshCooldownOptions
): UseRefreshCooldownReturn<T> {
  const cooldownMs = options?.cooldownMs ?? 30_000;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Update countdown every second when secondsLeft > 0
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (secondsLeft > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [secondsLeft > 0]);

  const canRefresh = secondsLeft === 0;

  const executeRefresh = useCallback(async (): Promise<T> => {
    setIsRefreshing(true);
    let result!: T;
    let error: Error | null = null;
    try {
      result = await refreshFn();
      setSecondsLeft(Math.ceil(cooldownMs / 1000));
    } catch (err) {
      error = err as Error;
    } finally {
      setIsRefreshing(false);
    }
    if (error) throw error;
    return result;
  }, [refreshFn, cooldownMs]);

  const refresh = useCallback((): Promise<T> => {
    if (!canRefresh || isRefreshing) return Promise.resolve(undefined as T);
    return executeRefresh();
  }, [canRefresh, isRefreshing, executeRefresh]);

  const forceRefresh = useCallback((): Promise<T> => {
    return executeRefresh();
  }, [executeRefresh]);

  return { canRefresh, isRefreshing, secondsLeft, refresh, forceRefresh };
}
