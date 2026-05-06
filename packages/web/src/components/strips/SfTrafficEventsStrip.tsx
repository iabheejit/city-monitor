import { useTranslation } from 'react-i18next';
import { useCityConfig } from '../../hooks/useCityConfig.js';
import { useSfTrafficEvents } from '../../hooks/useSfTrafficEvents.js';
import { useFreshness } from '../../hooks/useFreshness.js';
import { Skeleton } from '../layout/Skeleton.js';
import { TileFooter } from '../layout/TileFooter.js';
import type { SfTrafficEvent } from '../../lib/api.js';

const FRESH_MAX_AGE = 20 * 60 * 1000;
const COLLAPSED_ROWS = 4;

function roadLabel(event: SfTrafficEvent): string {
  if (event.roads.length === 0) return event.eventType;
  return event.roads[0] ?? event.eventType;
}

function EventRow({ event }: { event: SfTrafficEvent }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="shrink-0 text-sm px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        {event.eventType}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-2">{event.headline}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">{roadLabel(event)}</p>
      </div>
    </div>
  );
}

export function SfTrafficEventsStrip({ expanded = false }: { expanded?: boolean }) {
  const { id: cityId } = useCityConfig();
  const { data, fetchedAt, isLoading, isError } = useSfTrafficEvents(cityId);
  const { t } = useTranslation();
  const { isStale, agoText } = useFreshness(fetchedAt, FRESH_MAX_AGE);

  if (isLoading) return <Skeleton lines={3} />;
  if (isError || !data || data.events.length === 0) {
    return <p className="text-sm text-green-600 dark:text-green-400 py-2 text-center">{t('panel.sfTraffic.empty')}</p>;
  }

  const visible = expanded ? data.events : data.events.slice(0, COLLAPSED_ROWS);

  return (
    <>
      <div className="flex-1">
        {visible.map((event) => <EventRow key={event.id} event={event} />)}
        {!expanded && data.events.length > COLLAPSED_ROWS && (
          <p className="text-xs text-gray-400 text-center pt-1">
            +{data.events.length - COLLAPSED_ROWS} {t('panel.sfTraffic.more')}
          </p>
        )}
      </div>

      <TileFooter stale={isStale}>
        {t('panel.sfTraffic.source')}{agoText ? ` · ${agoText}` : ''}
      </TileFooter>
    </>
  );
}
