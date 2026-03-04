import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse, type PopulationSummary } from '../lib/api.js';

export function usePopulationSummary(cityId: string) {
  const query = useQuery<ApiResponse<PopulationSummary | null>>({
    queryKey: ['population-summary', cityId],
    queryFn: () => api.getPopulationSummary(cityId),
    staleTime: 12 * 60 * 60 * 1000,
    gcTime: 48 * 60 * 60 * 1000,
    retry: 2,
  });
  return { ...query, data: query.data?.data, fetchedAt: query.data?.fetchedAt ?? null };
}
