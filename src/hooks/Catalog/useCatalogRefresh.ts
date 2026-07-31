import { useToast } from '@/hooks/use-toast';
import { useGlobalRefresh } from '@/hooks/useGlobalRefresh';
import { useAppStore } from '@/store/useAppStore';
import { useRefreshStore, startCountdown } from '@/store/useRefreshStore';
import { useQueryClient } from '@tanstack/react-query';
import { fetchBuilds, checkNewBuilds } from '@/services/github';
import type { Build } from '@/types';

interface UseCatalogRefreshOptions {
  onError: (message: string) => void;
}

export function useCatalogRefresh({ onError }: UseCatalogRefreshOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canRefresh, isRefreshing, secondsLeft } = useGlobalRefresh();
  const storeLastFetched = useRefreshStore((s) => s.lastFetched);
  const begin = useRefreshStore((s) => s.begin);
  const end = useRefreshStore((s) => s.end);
  const setLastFetched = useRefreshStore((s) => s.setLastFetched);

  const handleRefreshClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canRefresh) {
      toast({
        title: 'Cooldown active',
        description: `Please wait ${secondsLeft}s before refreshing.`,
      });
      return;
    }
    try {
      begin(); // Disable button immediately before the async check

      // Step 1: Lightweight check using FetchMode::Conditional (ETag-cached, fast 304 if nothing changed)
      // If new builds are found, Step 2 does a full ForceRefresh fetch to update the local cache.
      // The double HTTP call is acceptable because ETag conditional requests make the first call
      // nearly instantaneous when the catalog hasn't changed on GitHub's side.
      const newBuilds = await checkNewBuilds();

      if (newBuilds.length > 0) {
        // Step 2: New builds found - fetch full catalog and update cache
        const freshBuilds = await fetchBuilds({ forceRefresh: true });
        queryClient.setQueryData(['builds', undefined], freshBuilds);
        const ts = await (await import('@/services/github')).getCatalogLastFetched();
        setLastFetched(ts);
        end(true); // Success -> trigger cooldown
        startCountdown();

        // Populate notification bell
        const buildLabels = newBuilds.map(
          (b: Build) => `${b.build_number} / ${b.backend} / ${b.architecture}`
        );
        useAppStore.getState().setNewBuilds(buildLabels);

        toast({
          title: 'Update found',
          description: `${newBuilds.length} build(s) not yet installed.`,
        });
      } else {
        // No new builds - clear bell and show toast
        useAppStore.getState().setNewBuilds([]);
        end(false);
        toast({ title: 'No updates', description: 'Catalog is already up to date.' });
      }
    } catch (err) {
      end(false); // No cooldown on error
      const message = err instanceof Error ? err.message : 'Failed to update';
      onError(message);
      toast({ title: 'Update failed', description: message });
    }
  };

  return {
    handleRefreshClick,
    isRefreshing,
    canRefresh,
    secondsLeft,
    storeLastFetched,
  };
}
