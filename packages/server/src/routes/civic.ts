import { Router } from 'express';
import type { Cache } from '../lib/cache.js';
import type { Db } from '../db/index.js';
import { loadNmcAnnouncements, loadNmrclStatus, loadNagpurPolice } from '../db/reads.js';
import { getCityConfig } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { CK } from '../lib/cache-keys.js';
import type { CivicCollection } from '@city-monitor/shared';

const log = createLogger('route:civic');

export function createCivicRouter(cache: Cache, db: Db | null = null) {
  const router = Router();

  router.get('/:city/nmc-announcements', async (req, res) => {
    const city = getCityConfig(req.params.city as string);
    if (!city) { res.status(404).json({ error: 'City not found' }); return; }
    if (!city.dataSources.nmcAnnouncements) { res.json({ data: null, fetchedAt: null }); return; }
    const cached = cache.getWithMeta<CivicCollection>(CK.nmcAnnouncements(city.id));
    if (cached) { res.json(cached); return; }
    if (db) {
      try {
        const result = await loadNmcAnnouncements(db, city.id);
        if (result) {
          cache.set(CK.nmcAnnouncements(city.id), result.data, 3600);
          res.json({ data: result.data, fetchedAt: result.fetchedAt.toISOString() });
          return;
        }
      } catch (err) { log.error(`${city.id} DB read failed`, err); }
    }
    res.json({ data: null, fetchedAt: null });
  });

  router.get('/:city/nmrcl-status', async (req, res) => {
    const city = getCityConfig(req.params.city as string);
    if (!city) { res.status(404).json({ error: 'City not found' }); return; }
    if (!city.dataSources.nmrclStatus) { res.json({ data: null, fetchedAt: null }); return; }
    const cached = cache.getWithMeta<CivicCollection>(CK.nmrclStatus(city.id));
    if (cached) { res.json(cached); return; }
    if (db) {
      try {
        const result = await loadNmrclStatus(db, city.id);
        if (result) {
          cache.set(CK.nmrclStatus(city.id), result.data, 3600);
          res.json({ data: result.data, fetchedAt: result.fetchedAt.toISOString() });
          return;
        }
      } catch (err) { log.error(`${city.id} DB read failed`, err); }
    }
    res.json({ data: null, fetchedAt: null });
  });

  router.get('/:city/nagpur-police', async (req, res) => {
    const city = getCityConfig(req.params.city as string);
    if (!city) { res.status(404).json({ error: 'City not found' }); return; }
    if (!city.dataSources.nagpurPolice) { res.json({ data: null, fetchedAt: null }); return; }
    const cached = cache.getWithMeta<CivicCollection>(CK.nagpurPolice(city.id));
    if (cached) { res.json(cached); return; }
    if (db) {
      try {
        const result = await loadNagpurPolice(db, city.id);
        if (result) {
          cache.set(CK.nagpurPolice(city.id), result.data, 3600);
          res.json({ data: result.data, fetchedAt: result.fetchedAt.toISOString() });
          return;
        }
      } catch (err) { log.error(`${city.id} DB read failed`, err); }
    }
    res.json({ data: null, fetchedAt: null });
  });

  return router;
}
