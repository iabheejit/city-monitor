import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api, type MgnregaSummary, type ApiResponse } from '../lib/api.js';

export function useMgnrega(cityId: string, enabled = true) {
  const query = useQuery<ApiResponse<MgnregaSummary | null>>({
    queryKey: ['mgnrega', cityId],
    queryFn: () => api.getMgnrega(cityId),
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
