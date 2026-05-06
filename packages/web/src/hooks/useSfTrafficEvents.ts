import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api, type SfTrafficEventsData, type ApiResponse } from '../lib/api.js';

export function useSfTrafficEvents(cityId: string, enabled = true) {
  const query = useQuery<ApiResponse<SfTrafficEventsData | null>>({
    queryKey: ['sf-traffic-events', cityId],
    queryFn: () => api.getSfTrafficEvents(cityId),
    enabled,
    refetchInterval: 15 * 60 * 1000,
    refetchIntervalInBackground: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 2,
    placeholderData: keepPreviousData,
  });
  return { ...query, data: query.data?.data ?? null, fetchedAt: query.data?.fetchedAt ?? null };
}
