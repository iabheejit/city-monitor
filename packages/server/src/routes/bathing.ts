/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Router } from 'express';
import type { Cache } from '../lib/cache.js';
import type { BathingSpot } from '../cron/ingest-bathing.js';
import { getCityConfig } from '../config/index.js';

export function createBathingRouter(cache: Cache) {
  const router = Router();

  router.get('/:city/bathing', (req, res) => {
    const city = getCityConfig(req.params.city);
    if (!city) {
      res.status(404).json({ error: 'City not found' });
      return;
    }

    const data = cache.get<BathingSpot[]>(`${city.id}:bathing:spots`);
    res.json(data ?? []);
  });

  return router;
}
