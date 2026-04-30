import { useTranslation } from 'react-i18next';
import { useCityConfig } from '../../hooks/useCityConfig.js';
import { useNewsDigest } from '../../hooks/useNewsDigest.js';
import { useFreshness } from '../../hooks/useFreshness.js';
import { formatRelativeTime } from '../../lib/format-time.js';
import { Skeleton } from '../layout/Skeleton.js';
import { TileFooter } from '../layout/TileFooter.js';

const FRESH_MAX_AGE = 15 * 60 * 1000;
const TRANSIT_CATEGORIES = ['transit'];
const MAX_ITEMS = 8;

export function NagpurTransitStrip() {
  const { id: cityId } = useCityConfig();
  const { data: digest, fetchedAt, isLoading } = useNewsDigest(cityId);
  const { t } = useTranslation();
  const { isStale, agoText } = useFreshness(fetchedAt, FRESH_MAX_AGE);

  if (isLoading) return <Skeleton lines={3} />;

  const items = TRANSIT_CATEGORIES.flatMap((cat) => digest?.categories?.[cat] ?? [])
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, MAX_ITEMS);

  if (items.length === 0) {
    return <p className="text-sm text-gray-400 py-2 text-center">{t('panel.nagpurTransit.empty')}</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-2 py-1">
        {items.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-2.5 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-start gap-2">
              <span className="shrink-0 text-base">🚌</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">{item.title}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {item.sourceName} · {formatRelativeTime(item.publishedAt)}
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>
      <TileFooter stale={isStale}>
        {t('panel.nagpurTransit.source')}{agoText ? ` · ${agoText}` : ''}
      </TileFooter>
    </>
  );
}
