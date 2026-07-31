import { useQuery } from '@tanstack/react-query';
import { fetchBuilds } from '@/services/github';
import type { Build } from '@/types';

export function useBuilds(limit?: number) {
  return useQuery<Build[], Error>({
    queryKey: ['builds', limit],
    queryFn: () => fetchBuilds({ limit }),
    staleTime: Infinity, // Cache for entire session — only refresh on explicit refetch
    retry: 2,
  });
}
