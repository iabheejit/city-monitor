/**
 * Feed ingestion cron job.
 *
 * Adapted from World Monitor (AGPL-3.0)
 * Original: server/worldmonitor/news/v1/list-feed-digest.ts
 * Copyright (C) 2024-2026 Elie Habib
 *
 * Modifications:
 * - City-scoped instead of global variant-based
 * - Uses fast-xml-parser instead of regex parsing
 * - Writes to in-memory cache (Postgres persistence added later)
 * - Simplified concurrency model (batch of 10 vs 20)
 */

import type { CityConfig, FeedConfig } from '@city-monitor/shared';
import type { Cache } from '../lib/cache.js';
import { parseFeed, type FeedItem } from '../lib/rss-parser.js';
import { classifyHeadline } from '../lib/classifier.js';
import { hashString } from '../lib/hash.js';
import { getActiveCities } from '../config/index.js';

const FEED_TIMEOUT_MS = 8_000;
const OVERALL_DEADLINE_MS = 25_000;
const BATCH_CONCURRENCY = 10;

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  sourceName: string;
  sourceUrl: string;
  description?: string;
  category: string;
  tier: number;
  lang: string;
}

export interface NewsDigest {
  items: NewsItem[];
  categories: Record<string, NewsItem[]>;
  updatedAt: string;
}

export function createFeedIngestion(cache: Cache) {
  return async function ingestFeeds(): Promise<void> {
    const cities = getActiveCities();
    for (const city of cities) {
      try {
        await ingestCityFeeds(city, cache);
      } catch (err) {
        console.error(`[ingest-feeds] ${city.id} failed:`, err);
      }
    }
  };
}

async function ingestCityFeeds(city: CityConfig, cache: Cache): Promise<void> {
  const deadline = Date.now() + OVERALL_DEADLINE_MS;
  const allItems: NewsItem[] = [];

  // Fetch feeds in batches
  for (let i = 0; i < city.feeds.length; i += BATCH_CONCURRENCY) {
    if (Date.now() > deadline) break;
    const batch = city.feeds.slice(i, i + BATCH_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((feed) => fetchAndParseFeed(feed, cache, deadline)),
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        allItems.push(...result.value);
      }
    }
  }

  // Deduplicate by hash
  const seen = new Set<string>();
  const deduped = allItems.filter((item) => {
    const hash = hashString(item.url + item.title);
    if (seen.has(hash)) return false;
    seen.add(hash);
    return true;
  });

  // Sort by tier (lower = higher priority), then recency
  deduped.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  // Build digest
  const categories: Record<string, NewsItem[]> = {};
  for (const item of deduped) {
    if (!categories[item.category]) {
      categories[item.category] = [];
    }
    categories[item.category]!.push(item);
  }

  const digest: NewsDigest = {
    items: deduped,
    categories,
    updatedAt: new Date().toISOString(),
  };

  // Write to cache
  cache.set(`${city.id}:news:digest`, digest, 900);
  for (const [cat, items] of Object.entries(categories)) {
    cache.set(`${city.id}:news:${cat}`, items, 900);
  }

  console.log(`[ingest-feeds] ${city.id}: ${deduped.length} articles from ${city.feeds.length} feeds`);
}

async function fetchAndParseFeed(
  feed: FeedConfig,
  cache: Cache,
  deadline: number,
): Promise<NewsItem[] | null> {
  const cacheKey = `feed:${hashString(feed.url)}`;
  const timeout = Math.min(FEED_TIMEOUT_MS, deadline - Date.now());
  if (timeout <= 0) return null;

  try {
    // Use cache for raw feed XML (avoid re-fetching within 10 min)
    const items = await cache.fetch<NewsItem[]>(cacheKey, 600, async () => {
      const response = await fetch(feed.url, {
        signal: AbortSignal.timeout(timeout),
        headers: { 'User-Agent': 'CityMonitor/1.0' },
      });
      if (!response.ok) return null;
      const xml = await response.text();
      const feedItems = parseFeed(xml);

      return feedItems.map((item): NewsItem => {
        const classification = classifyHeadline(item.title, 'berlin');
        return {
          id: hashString(item.url + item.title),
          title: item.title,
          url: item.url,
          publishedAt: item.publishedAt,
          sourceName: feed.name,
          sourceUrl: feed.url,
          description: item.description,
          category: feed.category || classification.category,
          tier: feed.tier,
          lang: feed.lang,
        };
      });
    });

    return items;
  } catch (err) {
    console.warn(`[ingest-feeds] Failed to fetch ${feed.name}:`, err);
    return null;
  }
}
