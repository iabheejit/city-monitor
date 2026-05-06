import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api, type Sf311Data, type ApiResponse } from '../lib/api.js';

export function useSf311(cityId: string, enabled = true) {
  const query = useQuery<ApiResponse<Sf311Data | null>>({
    queryKey: ['sf-311', cityId],
    queryFn: () => api.getSf311(cityId),
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
