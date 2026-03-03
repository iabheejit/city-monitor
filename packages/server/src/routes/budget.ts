/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Router } from 'express';
import type { Cache } from '../lib/cache.js';
import type { BudgetSummary } from '@city-monitor/shared';
import { getCityConfig } from '../config/index.js';

export function createBudgetRouter(cache: Cache) {
  const router = Router();

  router.get('/:city/budget', (req, res) => {
    const city = getCityConfig(req.params.city);
    if (!city) {
      res.status(404).json({ error: 'City not found' });
      return;
    }

    const data = cache.get<BudgetSummary>(`${city.id}:budget`);
    res.json(data ?? null);
  });

  return router;
}
