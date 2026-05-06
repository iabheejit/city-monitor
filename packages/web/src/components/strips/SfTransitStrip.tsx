import { useTranslation } from 'react-i18next';
import { useCityConfig } from '../../hooks/useCityConfig.js';
import { useSfTransitAlerts } from '../../hooks/useSfTransitAlerts.js';
import { useFreshness } from '../../hooks/useFreshness.js';
import { Skeleton } from '../layout/Skeleton.js';
import { TileFooter } from '../layout/TileFooter.js';
import type { SfTransitAlert } from '../../lib/api.js';

const FRESH_MAX_AGE = 20 * 60 * 1000;
const COLLAPSED_ROWS = 4;

const AGENCY_LABELS: Record<string, string> = {
  SF: 'Muni',
  BA: 'BART',
};

function AlertRow({ alert }: { alert: SfTransitAlert }) {
  const agency = AGENCY_LABELS[alert.agency] ?? alert.agency;
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="shrink-0 text-base">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-2">{alert.headerText}</p>
        {alert.descriptionText && (
          <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{alert.descriptionText}</p>
        )}
        <div className="flex gap-2 mt-0.5">
          <span className="text-xs text-blue-500 font-medium">{agency}</span>
          {alert.routeIds && alert.routeIds.length > 0 && (
            <span className="text-xs text-gray-400">{alert.routeIds.join(', ')}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function SfTransitStrip({ expanded = false }: { expanded?: boolean }) {
  const { id: cityId } = useCityConfig();
  const { data, fetchedAt, isLoading, isError } = useSfTransitAlerts(cityId);
  const { t } = useTranslation();
  const { isStale, agoText } = useFreshness(fetchedAt, FRESH_MAX_AGE);

  if (isLoading) return <Skeleton lines={3} />;
  if (isError || !data || data.alerts.length === 0) {
    return <p className="text-sm text-green-600 dark:text-green-400 py-2 text-center">{t('panel.sfTransit.noAlerts')}</p>;
  }

  const visible = expanded ? data.alerts : data.alerts.slice(0, COLLAPSED_ROWS);

  return (
    <>
      <div className="flex-1">
        {visible.map((a, i) => <AlertRow key={i} alert={a} />)}
        {!expanded && data.alerts.length > COLLAPSED_ROWS && (
          <p className="text-xs text-gray-400 text-center pt-1">
            +{data.alerts.length - COLLAPSED_ROWS} {t('panel.sfTransit.more')}
          </p>
        )}
      </div>
      <TileFooter stale={isStale}>
        {t('panel.sfTransit.source')}{agoText ? ` · ${agoText}` : ''}
      </TileFooter>
    </>
  );
}
