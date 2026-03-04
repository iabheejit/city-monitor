import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api, type ApiResponse } from '../lib/api.js';

export function usePopulation(cityId: string, enabled: boolean) {
  const query = useQuery<ApiResponse<GeoJSON.FeatureCollection | null>>({
    queryKey: ['population', cityId],
    queryFn: () => api.getPopulation(cityId),
    enabled,
    refetchInterval: 24 * 60 * 60 * 1000,
    refetchIntervalInBackground: false,
    staleTime: 12 * 60 * 60 * 1000,
    gcTime: 48 * 60 * 60 * 1000,
    retry: 2,
    placeholderData: keepPreviousData,
  });
  return { ...query, data: query.data?.data, fetchedAt: query.data?.fetchedAt ?? null };
}
