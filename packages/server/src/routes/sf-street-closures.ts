import { Router } from 'express';
import type { Cache } from '../lib/cache.js';
import type { Db } from '../db/index.js';
import { loadSfStreetClosures } from '../db/reads.js';
import { getCityConfig } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { CK } from '../lib/cache-keys.js';
import type { SfStreetClosuresData } from '@city-monitor/shared';

const log = createLogger('route:sf-street-closures');

export function createSfStreetClosuresRouter(cache: Cache, db: Db | null = null) {
  const router = Router();

  router.get('/:city/sf-street-closures', async (req, res) => {
    const city = getCityConfig(req.params.city);
    if (!city) {
      res.status(404).json({ error: 'City not found' });
      return;
    }

    if (city.country !== 'US') {
      res.json({ data: null, fetchedAt: null });
      return;
    }

    const cached = cache.getWithMeta<SfStreetClosuresData>(CK.sfStreetClosures(city.id));
    if (cached) {
      res.json(cached);
      return;
    }

    if (db) {
      try {
        const result = await loadSfStreetClosures(db, city.id);
        if (result) {
          cache.set(CK.sfStreetClosures(city.id), result.data, 86_400, result.fetchedAt);
          res.json({ data: result.data, fetchedAt: result.fetchedAt.toISOString() });
          return;
        }
      } catch (err) {
        log.error(`${city.id} DB read failed`, err);
      }
    }

    res.json({ data: null, fetchedAt: null });
  });

  return router;
}
