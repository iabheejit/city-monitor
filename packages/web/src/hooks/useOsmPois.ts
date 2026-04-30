import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api, type OsmPoiCollection, type ApiResponse } from '../lib/api.js';

export function useOsmPois(cityId: string, enabled = true) {
  const query = useQuery<ApiResponse<OsmPoiCollection | null>>({
    queryKey: ['osm-pois', cityId],
    queryFn: () => api.getOsmPois(cityId),
    enabled,
    refetchInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
    refetchIntervalInBackground: false,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    retry: 2,
    placeholderData: keepPreviousData,
  });
  return { ...query, data: query.data?.data ?? null, fetchedAt: query.data?.fetchedAt ?? null };
}
