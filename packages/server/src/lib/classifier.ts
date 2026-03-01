/**
 * Keyword-based news headline classifier for city categories.
 *
 * Adapted from World Monitor (AGPL-3.0)
 * Original: server/worldmonitor/news/v1/_classifier.ts
 * Copyright (C) 2024-2026 Elie Habib
 *
 * Modifications:
 * - Replaced global threat categories with city-level categories
 * - German keywords for Berlin-specific classification
 * - Simplified from 5 threat levels to 2 confidence tiers (high/medium)
 * - Kept word-boundary matching for short ambiguous terms
 */

export type CityCategory =
  | 'local'
  | 'politics'
  | 'transit'
  | 'culture'
  | 'crime'
  | 'weather'
  | 'economy'
  | 'sports';

export interface ClassificationResult {
  category: CityCategory;
  confidence: number;
}

interface KeywordTier {
  high: string[];
  medium: string[];
}

const BERLIN_KEYWORDS: Record<CityCategory, KeywordTier> = {
  transit: {
    high: ['Sperrung', 'Störung', 'Ausfall', 'BVG', 'S-Bahn', 'U-Bahn', 'Verspätung', 'gesperrt'],
    medium: ['Baustelle', 'Umleitung', 'Tram', 'Ringbahn'],
  },
  crime: {
    high: ['Mord', 'Überfall', 'Festnahme', 'Messerangriff', 'Schießerei'],
    medium: ['Diebstahl', 'Einbruch', 'Polizei', 'Razzia', 'Verdächtig'],
  },
  politics: {
    high: ['Senat', 'Abgeordnetenhaus', 'Bezirksbürgermeister'],
    medium: ['Wahl', 'Koalition', 'Protest', 'Demo', 'Bezirk', 'Bürgermeister'],
  },
  culture: {
    high: ['Berlinale', 'Museumsinsel', 'Philharmonie'],
    medium: ['Ausstellung', 'Konzert', 'Festival', 'Theater', 'Galerie', 'Kino'],
  },
  weather: {
    high: ['Unwetter', 'Hitzewelle', 'Sturm', 'Hochwasser'],
    medium: ['Regen', 'Schnee', 'Gewitter', 'Temperatur'],
  },
  economy: {
    high: ['Insolvenz', 'Startup', 'Ansiedlung'],
    medium: ['Arbeitsmarkt', 'Miete', 'Immobilien', 'Wirtschaft'],
  },
  sports: {
    high: ['Hertha', 'Union Berlin', 'Alba Berlin', 'Eisbären'],
    medium: ['Bundesliga', 'Olympiastadion', 'Marathon'],
  },
  local: { high: [], medium: [] },
};

const SHORT_KEYWORDS = new Set(['BVG', 'Demo', 'Mord', 'Wahl', 'Kino', 'Tram']);

const keywordRegexCache = new Map<string, RegExp>();

function getKeywordRegex(kw: string): RegExp {
  let re = keywordRegexCache.get(kw);
  if (!re) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    re = SHORT_KEYWORDS.has(kw)
      ? new RegExp(`\\b${escaped}\\b`, 'i')
      : new RegExp(escaped, 'i');
    keywordRegexCache.set(kw, re);
  }
  return re;
}

export function classifyHeadline(
  title: string,
  _cityId: string,
): ClassificationResult {
  const keywords = BERLIN_KEYWORDS; // TODO: per-city keyword maps when multi-city

  // Check high-confidence keywords first
  for (const [category, tier] of Object.entries(keywords) as [CityCategory, KeywordTier][]) {
    for (const kw of tier.high) {
      if (getKeywordRegex(kw).test(title)) {
        return { category, confidence: 0.85 };
      }
    }
  }

  // Then medium-confidence
  for (const [category, tier] of Object.entries(keywords) as [CityCategory, KeywordTier][]) {
    for (const kw of tier.medium) {
      if (getKeywordRegex(kw).test(title)) {
        return { category, confidence: 0.6 };
      }
    }
  }

  return { category: 'local', confidence: 0.3 };
}
