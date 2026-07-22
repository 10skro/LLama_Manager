import { useQuery } from '@tanstack/react-query';
import { fetchBuilds, checkNewBuilds } from '@/services/github';
import type { Build } from '@/types';

export function useBuilds(limit?: number) {
  return useQuery<Build[], Error>({
    queryKey: ['builds', limit],
    queryFn: () => fetchBuilds({ limit }),
    staleTime: Infinity, // Cache for entire session — only refresh on explicit refetch
    retry: 2,
  });
}

interface CheckNewBuildsResult {
  builds: Build[];
  newBuilds: Build[];
}

export function useCheckNewBuilds(limit?: number) {
  return useQuery<CheckNewBuildsResult, Error>({
    queryKey: ['new-builds', limit],
    queryFn: async () => {
      const [builds, newBuilds] = await Promise.all([
        fetchBuilds({ limit }),
        checkNewBuilds(),
      ]);
      return { builds, newBuilds };
    },
    staleTime: Infinity,
    enabled: false, // Manual trigger only
  });
}
