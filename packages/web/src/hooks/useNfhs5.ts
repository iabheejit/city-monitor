import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api, type Nfhs5Summary, type ApiResponse } from '../lib/api.js';

export function useNfhs5(cityId: string, enabled = true) {
  const query = useQuery<ApiResponse<Nfhs5Summary | null>>({
    queryKey: ['nfhs5', cityId],
    queryFn: () => api.getNfhs5(cityId),
    enabled,
    refetchInterval: 24 * 60 * 60 * 1000,  // 1 day (data is static)
    refetchIntervalInBackground: false,
    staleTime: 12 * 60 * 60 * 1000,
    gcTime: 30 * 24 * 60 * 60 * 1000,
    retry: 2,
    placeholderData: keepPreviousData,
  });
  return { ...query, data: query.data?.data ?? null, fetchedAt: query.data?.fetchedAt ?? null };
}
