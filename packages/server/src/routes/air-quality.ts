/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Router } from 'express';
import type { Cache } from '../lib/cache.js';
import type { AirQuality } from '../cron/ingest-weather.js';
import { getCityConfig } from '../config/index.js';

export function createAirQualityRouter(cache: Cache) {
  const router = Router();

  router.get('/:city/air-quality', (req, res) => {
    const city = getCityConfig(req.params.city);
    if (!city) {
      res.status(404).json({ error: 'City not found' });
      return;
    }

    const data = cache.get<AirQuality>(`${city.id}:air-quality`);
    res.json(data ?? null);
  });

  return router;
}
