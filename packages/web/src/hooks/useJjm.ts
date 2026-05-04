import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api, type JjmSummary, type ApiResponse } from '../lib/api.js';

export function useJjm(cityId: string, enabled = true) {
  const query = useQuery<ApiResponse<JjmSummary | null>>({
    queryKey: ['jjm', cityId],
    queryFn: () => api.getJjm(cityId),
    enabled,
    refetchInterval: 7 * 24 * 60 * 60 * 1000,  // 1 week
    refetchIntervalInBackground: false,
    staleTime: 3 * 24 * 60 * 60 * 1000,
    gcTime: 14 * 24 * 60 * 60 * 1000,
    retry: 2,
    placeholderData: keepPreviousData,
  });
  return { ...query, data: query.data?.data ?? null, fetchedAt: query.data?.fetchedAt ?? null };
}
