/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Router } from 'express';
import type { Cache } from '../lib/cache.js';
import { getCityConfig } from '../config/index.js';
import type { NewsDigest } from '../cron/ingest-feeds.js';

export function createNewsRouter(cache: Cache) {
  const router = Router();

  router.get('/:city/news/digest', (req, res) => {
    const city = getCityConfig(req.params.city);
    if (!city) {
      res.status(404).json({ error: 'City not found' });
      return;
    }

    const digest = cache.get<NewsDigest>(`${city.id}:news:digest`);
    if (!digest) {
      res.json({ items: [], categories: {}, updatedAt: null });
      return;
    }

    res.json(digest);
  });

  router.get('/:city/bootstrap', (req, res) => {
    const city = getCityConfig(req.params.city);
    if (!city) {
      res.status(404).json({ error: 'City not found' });
      return;
    }

    const data = cache.getBatch([
      `${city.id}:news:digest`,
      `${city.id}:weather`,
      `${city.id}:transit:alerts`,
      `${city.id}:events:upcoming`,
    ]);

    res.json({
      news: data[`${city.id}:news:digest`] ?? null,
      weather: data[`${city.id}:weather`] ?? null,
      transit: data[`${city.id}:transit:alerts`] ?? null,
      events: data[`${city.id}:events:upcoming`] ?? null,
    });
  });

  return router;
}
