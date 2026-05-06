import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api, type SfSafetyData, type ApiResponse } from '../lib/api.js';

export function useSfSafety(cityId: string, enabled = true) {
  const query = useQuery<ApiResponse<SfSafetyData | null>>({
    queryKey: ['sf-safety', cityId],
    queryFn: () => api.getSfSafety(cityId),
    enabled,
    refetchInterval: 10 * 60 * 1000,
    refetchIntervalInBackground: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 2,
    placeholderData: keepPreviousData,
  });
  return { ...query, data: query.data?.data ?? null, fetchedAt: query.data?.fetchedAt ?? null };
}
