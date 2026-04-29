import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api, type SchemeCatalogue, type ApiResponse } from '../lib/api.js';

export function useMyScheme(cityId: string, enabled = true) {
  const query = useQuery<ApiResponse<SchemeCatalogue | null>>({
    queryKey: ['myscheme', cityId],
    queryFn: () => api.getMyScheme(cityId),
    enabled,
    refetchInterval: 60 * 60 * 1000,      // 1 hour
    refetchIntervalInBackground: false,
    staleTime: 30 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 2,
    placeholderData: keepPreviousData,
  });
  return { ...query, data: query.data?.data ?? null, fetchedAt: query.data?.fetchedAt ?? null };
}
