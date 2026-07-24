import { useQuery } from '@tanstack/react-query';
import { getStorageUsage } from '@/services/version';

export function useStorageUsage() {
  const query = useQuery<number, Error>({
    queryKey: ['storage-usage'],
    queryFn: getStorageUsage,
    staleTime: 60 * 1000, // 1 minute — disk doesn't change that fast
    retry: 1,
  });

  return {
    storageUsage: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
