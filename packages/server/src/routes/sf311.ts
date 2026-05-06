import { Router } from 'express';
import type { Cache } from '../lib/cache.js';
import type { Db } from '../db/index.js';
import { loadSf311 } from '../db/reads.js';
import { getCityConfig } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { CK } from '../lib/cache-keys.js';
import type { Sf311Data } from '@city-monitor/shared';

const log = createLogger('route:sf311');

export function createSf311Router(cache: Cache, db: Db | null = null) {
  const router = Router();

  router.get('/:city/sf-311', async (req, res) => {
    const city = getCityConfig(req.params.city);
    if (!city) {
      res.status(404).json({ error: 'City not found' });
      return;
    }

    if (city.country !== 'US') {
      res.json({ data: null, fetchedAt: null });
      return;
    }

    const cached = cache.getWithMeta<Sf311Data>(CK.sf311(city.id));
    if (cached) {
      res.json(cached);
      return;
    }

    if (db) {
      try {
        const result = await loadSf311(db, city.id);
        if (result) {
          cache.set(CK.sf311(city.id), result.data, 86_400, result.fetchedAt);
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
