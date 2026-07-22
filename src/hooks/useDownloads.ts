import { useQuery } from '@tanstack/react-query';

export function useDownloads() {
  return useQuery({
    queryKey: ['downloads'],
    queryFn: async () => [], // Will be populated by events
    staleTime: 0,
    refetchInterval: 5000,
  });
}
