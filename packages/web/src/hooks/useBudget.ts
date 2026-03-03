/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api, type BudgetSummary } from '../lib/api.js';

export function useBudget(cityId: string) {
  return useQuery<BudgetSummary | null>({
    queryKey: ['budget', cityId],
    queryFn: () => api.getBudget(cityId),
    refetchInterval: 60 * 60 * 1000, // 1 hour — data changes very rarely
    refetchIntervalInBackground: false,
    staleTime: 30 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 2,
    placeholderData: keepPreviousData,
  });
}
