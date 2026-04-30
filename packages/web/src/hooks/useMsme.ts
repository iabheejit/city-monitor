import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api, type MsmeSummary, type ApiResponse } from '../lib/api.js';

export function useMsme(cityId: string, enabled = true) {
  const query = useQuery<ApiResponse<MsmeSummary | null>>({
    queryKey: ['msme', cityId],
    queryFn: () => api.getMsme(cityId),
    enabled,
    refetchInterval: 24 * 60 * 60 * 1000,  // 24 hours (monthly ingestion)
    refetchIntervalInBackground: false,
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 48 * 60 * 60 * 1000,
    retry: 2,
    placeholderData: keepPreviousData,
  });
  return { ...query, data: query.data?.data ?? null, fetchedAt: query.data?.fetchedAt ?? null };
}
