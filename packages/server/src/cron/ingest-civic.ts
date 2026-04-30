/**
 * Civic scrapers for Nagpur:
 * - NMC (Nagpur Municipal Corporation) announcements via RSS/HTML
 * - NMRCL (Nagpur Metro) service status via press releases page
 * - Nagpur Police news via RSS/HTML
 *
 * All three produce CivicCollection snapshots.
 * Since cheerio is not available, we use fast-xml-parser for RSS feeds
 * and native fetch + regex for HTML scraping.
 */
import { XMLParser } from 'fast-xml-parser';
import type { CivicCollection, CivicItem } from '@city-monitor/shared';
import type { Cache } from '../lib/cache.js';
import type { Db } from '../db/index.js';
import { saveNmcAnnouncements, saveNmrclStatus, saveNagpurPolice } from '../db/writes.js';
import { getActiveCities } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { CK } from '../lib/cache-keys.js';

const log = createLogger('ingest-civic');

const FETCH_TIMEOUT_MS = 20_000;
const TTL_SECONDS = 3_600; // 1 hour

// ---------------------------------------------------------------------------
// NMC — RSS feed from nagpurcorporation.gov.in
// ---------------------------------------------------------------------------
const NMC_RSS_URL = 'https://www.nagpurcorporation.gov.in/rss.aspx';

// ---------------------------------------------------------------------------
// NMRCL — press releases / news page (HTML)
// ---------------------------------------------------------------------------
const NMRCL_NEWS_URL = 'https://www.nagpurmetro.com/press-release';

// ---------------------------------------------------------------------------
// Nagpur Police — press release page (HTML)
// ---------------------------------------------------------------------------
const NAGPUR_POLICE_URL = 'https://nagpurpolice.gov.in/press-release/';

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CityMonitorBot/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/rss+xml,*/*',
      },
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.text();
  } catch (err) {
    log.warn(`fetchText ${url} failed: ${(err as Error).message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function hashId(source: string, url: string, title: string): string {
  // Simple deterministic hash for deduplication
  const s = `${source}:${url}:${title}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return Math.abs(h).toString(16);
}

// ---------------------------------------------------------------------------
// NMC — parse RSS
// ---------------------------------------------------------------------------
async function fetchNmc(): Promise<CivicCollection | null> {
  const xml = await fetchText(NMC_RSS_URL);
  if (!xml) return fallbackNmc();

  try {
    const parsed = xmlParser.parse(xml);
    const channel = parsed?.rss?.channel ?? parsed?.feed;
    if (!channel) return fallbackNmc();

    const rawItems: unknown[] = Array.isArray(channel.item) ? channel.item
      : channel.item ? [channel.item]
      : Array.isArray(channel.entry) ? channel.entry
      : channel.entry ? [channel.entry] : [];

    const items: CivicItem[] = rawItems.slice(0, 20).map((raw: unknown) => {
      const r = raw as Record<string, unknown>;
      const title = String(r.title ?? '').trim();
      const url = String(r.link ?? r.guid ?? NMC_RSS_URL).trim();
      const pubDate = String(r.pubDate ?? r.published ?? r.updated ?? '').trim();
      const description = String(r.description ?? r.summary ?? '').replace(/<[^>]+>/g, '').trim().slice(0, 300);
      return {
        id: hashId('nmc', url, title),
        title: title || 'NMC Announcement',
        description: description || undefined,
        url,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        source: 'nmc' as const,
        category: 'civic',
      };
    }).filter((i) => i.title !== 'NMC Announcement' || i.url !== NMC_RSS_URL);

    return { items, fetchedAt: new Date().toISOString(), source: 'nmc' };
  } catch (err) {
    log.warn(`NMC RSS parse failed: ${(err as Error).message}`);
    return fallbackNmc();
  }
}

function fallbackNmc(): CivicCollection {
  return { items: [], fetchedAt: new Date().toISOString(), source: 'nmc' };
}

// ---------------------------------------------------------------------------
// NMRCL — scrape HTML press releases
// ---------------------------------------------------------------------------
async function fetchNmrcl(): Promise<CivicCollection | null> {
  const html = await fetchText(NMRCL_NEWS_URL);
  if (!html) return { items: [], fetchedAt: new Date().toISOString(), source: 'nmrcl' };

  const items: CivicItem[] = [];
  // Match anchor tags with press release links
  const anchorRe = /<a[^>]+href="([^"]*(?:press|news|release|update)[^"]*)"[^>]*>([^<]{5,200})<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRe.exec(html)) !== null && items.length < 15) {
    const href = match[1].startsWith('http') ? match[1] : `https://www.nagpurmetro.com${match[1]}`;
    const title = match[2].replace(/\s+/g, ' ').trim();
    if (!title || title.length < 5) continue;
    items.push({
      id: hashId('nmrcl', href, title),
      title,
      url: href,
      publishedAt: new Date().toISOString(),
      source: 'nmrcl',
      category: 'transit',
    });
  }

  return { items, fetchedAt: new Date().toISOString(), source: 'nmrcl' };
}

// ---------------------------------------------------------------------------
// Nagpur Police — scrape HTML press releases
// ---------------------------------------------------------------------------
async function fetchNagpurPolice(): Promise<CivicCollection | null> {
  const html = await fetchText(NAGPUR_POLICE_URL);
  if (!html) return { items: [], fetchedAt: new Date().toISOString(), source: 'nagpur-police' };

  const items: CivicItem[] = [];
  const anchorRe = /<a[^>]+href="([^"]*(?:press|news|release|crime|arrest|notice)[^"]*)"[^>]*>([^<]{5,200})<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRe.exec(html)) !== null && items.length < 15) {
    const href = match[1].startsWith('http') ? match[1] : `https://nagpurpolice.gov.in${match[1]}`;
    const title = match[2].replace(/\s+/g, ' ').trim();
    if (!title || title.length < 5) continue;
    items.push({
      id: hashId('nagpur-police', href, title),
      title,
      url: href,
      publishedAt: new Date().toISOString(),
      source: 'nagpur-police',
      category: 'crime',
    });
  }

  return { items, fetchedAt: new Date().toISOString(), source: 'nagpur-police' };
}

// ---------------------------------------------------------------------------
// Exported ingestion factory
// ---------------------------------------------------------------------------
export function createCivicIngestion(cache: Cache, db: Db | null = null) {
  return async function ingestCivic(): Promise<void> {
    const cities = getActiveCities();
    for (const city of cities) {
      if (city.id !== 'nagpur') continue;

      // NMC
      if (city.dataSources.nmcAnnouncements) {
        try {
          const data = await fetchNmc();
          if (data) {
            cache.set(CK.nmcAnnouncements(city.id), data, TTL_SECONDS);
            if (db) await saveNmcAnnouncements(db, city.id, data);
            log.info(`${city.id} NMC: ${data.items.length} items`);
          }
        } catch (err) { log.error(`${city.id} NMC failed: ${(err as Error).message}`); }
      }

      // NMRCL
      if (city.dataSources.nmrclStatus) {
        try {
          const data = await fetchNmrcl();
          if (data) {
            cache.set(CK.nmrclStatus(city.id), data, TTL_SECONDS);
            if (db) await saveNmrclStatus(db, city.id, data);
            log.info(`${city.id} NMRCL: ${data.items.length} items`);
          }
        } catch (err) { log.error(`${city.id} NMRCL failed: ${(err as Error).message}`); }
      }

      // Police
      if (city.dataSources.nagpurPolice) {
        try {
          const data = await fetchNagpurPolice();
          if (data) {
            cache.set(CK.nagpurPolice(city.id), data, TTL_SECONDS);
            if (db) await saveNagpurPolice(db, city.id, data);
            log.info(`${city.id} Police: ${data.items.length} items`);
          }
        } catch (err) { log.error(`${city.id} Police failed: ${(err as Error).message}`); }
      }
    }
  };
}
