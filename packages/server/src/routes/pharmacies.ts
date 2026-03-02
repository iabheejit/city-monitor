/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Router } from 'express';
import type { Cache } from '../lib/cache.js';
import type { EmergencyPharmacy } from '../cron/ingest-pharmacies.js';
import { getCityConfig } from '../config/index.js';

export function createPharmaciesRouter(cache: Cache) {
  const router = Router();

  router.get('/:city/pharmacies', (req, res) => {
    const city = getCityConfig(req.params.city);
    if (!city) {
      res.status(404).json({ error: 'City not found' });
      return;
    }

    const data = cache.get<EmergencyPharmacy[]>(`${city.id}:pharmacies:emergency`);
    res.json(data ?? []);
  });

  return router;
}
