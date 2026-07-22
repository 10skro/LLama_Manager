import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { FavoriteBuild } from '@/types';

export function useFavorites() {
  return useQuery<FavoriteBuild[], Error>({
    queryKey: ['favorite-builds'],
    queryFn: () => invoke<FavoriteBuild[]>('get_favorite_builds') as Promise<FavoriteBuild[]>,
    staleTime: Infinity,
    retry: 1,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ downloadUrl, buildNumber, backend }: { downloadUrl: string; buildNumber: string; backend: string }) => {
      return invoke<boolean>('toggle_favorite_build', { buildNumber, backend, downloadUrl }) as Promise<boolean>;
    },
    onMutate: async ({ downloadUrl, buildNumber, backend }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['favorite-builds'] });

      // Snapshot previous value (may be undefined if query hasn't run yet)
      const previous = queryClient.getQueryData<FavoriteBuild[]>(['favorite-builds']) ?? [];

      // Optimistically update
      const isFav = previous.some(f => f.download_url === downloadUrl);
      const updated = isFav
        ? previous.filter(f => f.download_url !== downloadUrl)
        : [...previous, { id: 0, build_number: buildNumber, backend, download_url: downloadUrl }];

      queryClient.setQueryData<FavoriteBuild[]>(['favorite-builds'], updated);

      return { previous };
    },
    onError: (err: unknown, _vars, context) => {
      // Rollback on error
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['favorite-builds'], context.previous);
      } else {
        // If there was no previous data, just invalidate to refetch
        queryClient.invalidateQueries({ queryKey: ['favorite-builds'] });
      }
      console.error('Failed to toggle favorite:', err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-builds'] });
    },
  });
}
