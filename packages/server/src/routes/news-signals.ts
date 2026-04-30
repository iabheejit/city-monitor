import { Router } from 'express';
import type { Cache } from '../lib/cache.js';
import { getCityConfig } from '../config/index.js';
import { CK } from '../lib/cache-keys.js';
import type { NewsItem, NewsDigest, NewsSignals } from '@city-monitor/shared';

const TRANSIT_RE = /metro|bus|train|railway|transport|traffic/i;
const SAFETY_RE = /crime|police|arrest|theft|robbery|accident/i;
const CIVIC_RE = /NMC|municipal corporation|civic|ward|garbage|sewage/i;

function classifyItems(items: NewsItem[]): NewsSignals {
  const transit: NewsItem[] = [];
  const safety: NewsItem[] = [];
  const civic: NewsItem[] = [];
  for (const item of items) {
    const text = item.title + ' ' + (item.description ?? '');
    if (item.category === 'transit' || TRANSIT_RE.test(text)) { transit.push(item); }
    else if (item.category === 'crime' || SAFETY_RE.test(text)) { safety.push(item); }
    else if (CIVIC_RE.test(text)) { civic.push(item); }
  }
  return { transit: transit.slice(0,5), safety: safety.slice(0,5), civic: civic.slice(0,5), fetchedAt: new Date().toISOString() };
}

export function createNewsSignalsRouter(cache: Cache) {
  const router = Router();
  router.get('/:city/news-signals', (req, res) => {
    const city = getCityConfig(req.params.city);
    if (!city) { res.status(404).json({ error: 'City not found' }); return; }
    const digest = cache.get<NewsDigest>(CK.newsDigest(city.id));
    if (!digest) { res.json({ data: null, fetchedAt: null }); return; }
    const signals = classifyItems(digest.items);
    res.json({ data: signals, fetchedAt: signals.fetchedAt });
  });
  return router;
}
