import { Router } from 'express';
import type { Cache } from '../lib/cache.js';
import type { Db } from '../db/index.js';
import { loadCpcbAqi } from '../db/reads.js';
import { getCityConfig } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { CK } from '../lib/cache-keys.js';
import type { CpcbAqiData } from '@city-monitor/shared';

const log = createLogger('route:cpcb-aqi');

export function createCpcbAqiRouter(cache: Cache, db: Db | null = null) {
  const router = Router();

  router.get('/:city/cpcb-aqi', async (req, res) => {
    const city = getCityConfig(req.params.city);
    if (!city) {
      res.status(404).json({ error: 'City not found' });
      return;
    }

    if (!city.dataSources.cpcbAqi) {
      res.json({ data: null, fetchedAt: null });
      return;
    }

    const cached = cache.getWithMeta<CpcbAqiData>(CK.cpcbAqi(city.id));
    if (cached) {
      res.json(cached);
      return;
    }

    if (db) {
      try {
        const result = await loadCpcbAqi(db, city.id);
        if (result) {
          cache.set(CK.cpcbAqi(city.id), result.data, 1800, result.fetchedAt);
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
