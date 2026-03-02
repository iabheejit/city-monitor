/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api, type AirQuality } from '../lib/api.js';

export function useAirQuality(cityId: string) {
  return useQuery<AirQuality | null>({
    queryKey: ['air-quality', cityId],
    queryFn: () => api.getAirQuality(cityId),
    refetchInterval: 30 * 60 * 1000,
    refetchIntervalInBackground: false,
    staleTime: 15 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 2,
    placeholderData: keepPreviousData,
  });
}
