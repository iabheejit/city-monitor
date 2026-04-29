import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCityConfig } from '../../hooks/useCityConfig.js';
import { useMyScheme } from '../../hooks/useMyScheme.js';
import { useFreshness } from '../../hooks/useFreshness.js';
import { StripErrorFallback } from '../ErrorFallback.js';
import { Skeleton } from '../layout/Skeleton.js';
import { TileFooter } from '../layout/TileFooter.js';
import type { SchemeEntry } from '../../lib/api.js';

const FRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days (schemes rarely change)
const COLLAPSED_COUNT = 3;

const CATEGORY_COLORS: Record<string, string> = {
  education: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  health: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  livelihood: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  housing: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
};

function categoryColor(benefitType: string): string {
  const bt = benefitType.toLowerCase();
  if (bt.includes('education') || bt.includes('scholarship')) return CATEGORY_COLORS.education!;
  if (bt.includes('health') || bt.includes('medical')) return CATEGORY_COLORS.health!;
  if (bt.includes('employment') || bt.includes('livelihood') || bt.includes('skill')) return CATEGORY_COLORS.livelihood!;
  if (bt.includes('housing') || bt.includes('home')) return CATEGORY_COLORS.housing!;
  return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300';
}

function SchemeCard({ scheme }: { scheme: SchemeEntry }) {
  return (
    <div className="flex flex-col gap-1 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="flex items-start gap-2">
        <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${categoryColor(scheme.benefitType)}`}>
          {scheme.benefitType || 'General'}
        </span>
        <a
          href={scheme.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline leading-snug"
        >
          {scheme.name}
        </a>
      </div>
      {scheme.ministry && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{scheme.ministry}</p>
      )}
      {scheme.description && (
        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{scheme.description}</p>
      )}
    </div>
  );
}

export function SchemesStrip({ expanded = false, onExpand }: { expanded?: boolean; onExpand?: () => void }) {
  const { id: cityId, dataSources } = useCityConfig();
  const hasMyScheme = Boolean(dataSources.myScheme);
  const { data, fetchedAt, isLoading, isError, refetch } = useMyScheme(cityId, hasMyScheme);
  const { t } = useTranslation();
  const { isStale, agoText } = useFreshness(fetchedAt, FRESH_MAX_AGE);
  const [searchQuery, setSearchQuery] = useState('');

  if (!hasMyScheme) return null;
  if (isLoading) return <Skeleton lines={4} />;
  if (isError) return <StripErrorFallback domain="Government Schemes" onRetry={refetch} />;
  if (!data || data.schemes.length === 0) {
    return <p className="text-sm text-gray-400 py-2 text-center">{t('panel.schemes.empty')}</p>;
  }

  const filtered = searchQuery
    ? data.schemes.filter((s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.benefitType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.ministry.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    : data.schemes;

  const visible = expanded ? filtered : filtered.slice(0, COLLAPSED_COUNT);
  const hiddenCount = filtered.length - visible.length;

  return (
    <>
      <div className="flex flex-col gap-1 flex-1">
        {/* Count summary */}
        {!expanded && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {t('panel.schemes.available', { count: data.totalCount })}
          </p>
        )}

        {/* Search (expanded only) */}
        {expanded && (
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('panel.schemes.search')}
            className="w-full px-2 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 mb-2"
          />
        )}

        {/* Scheme list */}
        {visible.map((scheme) => (
          <SchemeCard key={scheme.id} scheme={scheme} />
        ))}

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={onExpand}
            className="w-full text-xs text-gray-400 dark:text-gray-500 text-center pt-1 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
          >
            +{hiddenCount} {t('panel.schemes.more')}
          </button>
        )}
      </div>
      <TileFooter stale={isStale}>
        {t('panel.schemes.source')}
        {agoText && (' · ' + t('stale.updated', { time: agoText }))}
      </TileFooter>
    </>
  );
}
