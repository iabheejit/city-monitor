import { useTranslation } from 'react-i18next';
import { useCityConfig } from '../../hooks/useCityConfig.js';
import { useNagpurPolice } from '../../hooks/useCivic.js';
import { useFreshness } from '../../hooks/useFreshness.js';
import { formatRelativeTime } from '../../lib/format-time.js';
import { Skeleton } from '../layout/Skeleton.js';
import { TileFooter } from '../layout/TileFooter.js';

const FRESH_MAX_AGE = 4 * 60 * 60 * 1000;

export function NagpurPoliceStrip() {
  const { id: cityId } = useCityConfig();
  const { data, fetchedAt, isLoading } = useNagpurPolice(cityId);
  const { t } = useTranslation();
  const { isStale, agoText } = useFreshness(fetchedAt, FRESH_MAX_AGE);

  if (isLoading) return <Skeleton lines={3} />;
  const items = data?.items ?? [];

  if (items.length === 0) {
    return <p className="text-sm text-gray-400 py-2 text-center">{t('panel.nagpurPolice.empty')}</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-2 py-1">
        {items.slice(0, 8).map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-2.5 rounded border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
          >
            <div className="flex items-start gap-2">
              <span className="shrink-0 text-base">🚔</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">{item.title}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatRelativeTime(item.publishedAt)}</p>
              </div>
            </div>
          </a>
        ))}
      </div>
      <TileFooter stale={isStale}>
        {t('panel.nagpurPolice.source')}{agoText ? ` · ${agoText}` : ''}
      </TileFooter>
    </>
  );
}
