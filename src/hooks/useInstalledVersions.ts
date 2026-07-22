import { useQuery } from '@tanstack/react-query';
import { getInstalledVersions } from '@/services/version';

export function useInstalledVersions() {
  return useQuery({
    queryKey: ['installed-versions'],
    queryFn: getInstalledVersions,
    staleTime: 10 * 60 * 1000,
  });
}
