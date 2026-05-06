import { useTranslation } from 'react-i18next';
import { useCityConfig } from '../../hooks/useCityConfig.js';
import { useSfStreetClosures } from '../../hooks/useSfStreetClosures.js';
import { useFreshness } from '../../hooks/useFreshness.js';
import { Skeleton } from '../layout/Skeleton.js';
import { TileFooter } from '../layout/TileFooter.js';
import type { SfStreetClosure } from '../../lib/api.js';

const FRESH_MAX_AGE = 60 * 60 * 1000;
const COLLAPSED_ROWS = 5;

function ClosureRow({ closure }: { closure: SfStreetClosure }) {
  const start = closure.startDate ? new Date(closure.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const end = closure.endDate ? new Date(closure.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  return (
    <div className="flex items-start gap-2 py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="shrink-0 text-base">🚧</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{closure.streetName}</p>
        {closure.reason && <p className="text-xs text-gray-400 truncate">{closure.reason}</p>}
      </div>
      {(start || end) && (
        <span className="shrink-0 text-xs text-gray-400 whitespace-nowrap">{start}{end && start !== end ? `–${end}` : ''}</span>
      )}
    </div>
  );
}

export function SfStreetClosuresStrip({ expanded = false }: { expanded?: boolean }) {
  const { id: cityId } = useCityConfig();
  const { data, fetchedAt, isLoading, isError } = useSfStreetClosures(cityId);
  const { t } = useTranslation();
  const { isStale, agoText } = useFreshness(fetchedAt, FRESH_MAX_AGE);

  if (isLoading) return <Skeleton lines={3} />;
  if (isError || !data || data.closures.length === 0) {
    return <p className="text-sm text-gray-400 py-2 text-center">{t('panel.sfStreetClosures.empty')}</p>;
  }

  const visible = expanded ? data.closures : data.closures.slice(0, COLLAPSED_ROWS);

  return (
    <>
      <div className="flex-1">
        <p className="text-xs text-gray-400 mb-1">
          {t('panel.sfStreetClosures.total', { count: data.closures.length })}
        </p>
        {visible.map((c, i) => <ClosureRow key={i} closure={c} />)}
        {!expanded && data.closures.length > COLLAPSED_ROWS && (
          <p className="text-xs text-gray-400 text-center pt-1">
            +{data.closures.length - COLLAPSED_ROWS} {t('panel.sfStreetClosures.more')}
          </p>
        )}
      </div>
      <TileFooter stale={isStale}>
        {t('panel.sfStreetClosures.source')}{agoText ? ` · ${agoText}` : ''}
      </TileFooter>
    </>
  );
}
