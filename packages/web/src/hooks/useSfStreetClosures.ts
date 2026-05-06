import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api, type SfStreetClosuresData, type ApiResponse } from '../lib/api.js';

export function useSfStreetClosures(cityId: string, enabled = true) {
  const query = useQuery<ApiResponse<SfStreetClosuresData | null>>({
    queryKey: ['sf-street-closures', cityId],
    queryFn: () => api.getSfStreetClosures(cityId),
    enabled,
    refetchInterval: 60 * 60 * 1000,
    refetchIntervalInBackground: false,
    staleTime: 30 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 2,
    placeholderData: keepPreviousData,
  });
  return { ...query, data: query.data?.data ?? null, fetchedAt: query.data?.fetchedAt ?? null };
}
