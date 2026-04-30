import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api, type CivicCollection, type ApiResponse } from '../lib/api.js';

export function useNmcAnnouncements(cityId: string, enabled = true) {
  const query = useQuery<ApiResponse<CivicCollection | null>>({
    queryKey: ['nmc-announcements', cityId],
    queryFn: () => api.getNmcAnnouncements(cityId),
    enabled,
    refetchInterval: 2 * 60 * 60 * 1000, // 2 hours
    staleTime: 60 * 60 * 1000,
    retry: 2,
    placeholderData: keepPreviousData,
  });
  return { ...query, data: query.data?.data ?? null, fetchedAt: query.data?.fetchedAt ?? null };
}

export function useNmrclStatus(cityId: string, enabled = true) {
  const query = useQuery<ApiResponse<CivicCollection | null>>({
    queryKey: ['nmrcl-status', cityId],
    queryFn: () => api.getNmrclStatus(cityId),
    enabled,
    refetchInterval: 2 * 60 * 60 * 1000,
    staleTime: 60 * 60 * 1000,
    retry: 2,
    placeholderData: keepPreviousData,
  });
  return { ...query, data: query.data?.data ?? null, fetchedAt: query.data?.fetchedAt ?? null };
}

export function useNagpurPolice(cityId: string, enabled = true) {
  const query = useQuery<ApiResponse<CivicCollection | null>>({
    queryKey: ['nagpur-police', cityId],
    queryFn: () => api.getNagpurPolice(cityId),
    enabled,
    refetchInterval: 2 * 60 * 60 * 1000,
    staleTime: 60 * 60 * 1000,
    retry: 2,
    placeholderData: keepPreviousData,
  });
  return { ...query, data: query.data?.data ?? null, fetchedAt: query.data?.fetchedAt ?? null };
}
