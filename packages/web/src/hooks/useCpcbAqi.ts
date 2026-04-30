import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api, type CpcbAqiData, type ApiResponse } from '../lib/api.js';

export function useCpcbAqi(cityId: string, enabled = true) {
  const query = useQuery<ApiResponse<CpcbAqiData | null>>({
    queryKey: ['cpcb-aqi', cityId],
    queryFn: () => api.getCpcbAqi(cityId),
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
