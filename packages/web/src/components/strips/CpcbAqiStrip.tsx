import { useTranslation } from 'react-i18next';
import { useCityConfig } from '../../hooks/useCityConfig.js';
import { useCpcbAqi } from '../../hooks/useCpcbAqi.js';
import { useFreshness } from '../../hooks/useFreshness.js';
import { StripErrorFallback } from '../ErrorFallback.js';
import { Skeleton } from '../layout/Skeleton.js';
import { TileFooter } from '../layout/TileFooter.js';
import type { CpcbStation } from '../../lib/api.js';

const FRESH_MAX_AGE = 2 * 60 * 60 * 1000; // 2 hours

// Simple AQI colour from PM2.5 value (CPCB breakpoints)
function pm25Color(pm25: number | undefined): string {
  if (pm25 === undefined) return 'text-gray-400';
  if (pm25 <= 30) return 'text-green-600 dark:text-green-400';
  if (pm25 <= 60) return 'text-yellow-500 dark:text-yellow-400';
  if (pm25 <= 90) return 'text-orange-500 dark:text-orange-400';
  if (pm25 <= 120) return 'text-red-600 dark:text-red-400';
  return 'text-purple-700 dark:text-purple-400';
}

function pm25Label(pm25: number | undefined, t: (k: string) => string): string {
  if (pm25 === undefined) return t('panel.cpcbAqi.na');
  if (pm25 <= 30) return t('panel.cpcbAqi.good');
  if (pm25 <= 60) return t('panel.cpcbAqi.satisfactory');
  if (pm25 <= 90) return t('panel.cpcbAqi.moderate');
  if (pm25 <= 120) return t('panel.cpcbAqi.poor');
  return t('panel.cpcbAqi.veryPoor');
}

function StationRow({ station }: { station: CpcbStation }) {
  const { t } = useTranslation();
  const pm25 = station.pollutants.pm25;
  return (
    <div className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{station.station}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {Object.entries(station.pollutants)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => `${k.toUpperCase()} ${v}`)
            .join(' · ')}
        </p>
      </div>
      <div className="text-right shrink-0">
        <span className={`text-sm font-bold tabular-nums ${pm25Color(pm25)}`}>
          {pm25 !== undefined ? pm25.toFixed(1) : '—'}
        </span>
        <p className={`text-xs ${pm25Color(pm25)}`}>{pm25Label(pm25, t)}</p>
      </div>
    </div>
  );
}

export function CpcbAqiStrip() {
  const { id: cityId, dataSources } = useCityConfig();
  const hasCpcbAqi = Boolean(dataSources.cpcbAqi);
  const { data, fetchedAt, isLoading, isError, refetch } = useCpcbAqi(cityId, hasCpcbAqi);
  const { t } = useTranslation();
  const { isStale, agoText } = useFreshness(fetchedAt, FRESH_MAX_AGE);

  if (!hasCpcbAqi) return null;
  if (isLoading) return <Skeleton lines={3} />;
  if (isError) return <StripErrorFallback domain="CPCB AQI" onRetry={refetch} />;
  if (!data || data.stations.length === 0) {
    return <p className="text-sm text-gray-400 py-2 text-center">{t('panel.cpcbAqi.empty')}</p>;
  }

  // Average PM2.5 across stations for headline
  const pm25Values = data.stations.map(s => s.pollutants.pm25).filter((v): v is number => v !== undefined);
  const avgPm25 = pm25Values.length > 0 ? pm25Values.reduce((a, b) => a + b, 0) / pm25Values.length : undefined;

  return (
    <>
      <div className="flex flex-col gap-3 py-1">
        {/* City-wide average headline */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {t('panel.cpcbAqi.avgPm25')} · {data.stations.length} {t('panel.cpcbAqi.stations')}
          </span>
          <span className={`text-2xl font-extrabold tabular-nums ${pm25Color(avgPm25)}`}>
            {avgPm25 !== undefined ? avgPm25.toFixed(1) : '—'} <span className="text-sm font-normal">µg/m³</span>
          </span>
        </div>

        {/* Station breakdown */}
        <div className="flex flex-col">
          {data.stations.slice(0, 6).map((s, i) => (
            <StationRow key={i} station={s} />
          ))}
          {data.stations.length > 6 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">
              +{data.stations.length - 6} {t('panel.cpcbAqi.moreStations')}
            </p>
          )}
        </div>
      </div>

      <TileFooter stale={isStale}>
        {t('panel.cpcbAqi.source')}{agoText ? ` · ${agoText}` : ''}
      </TileFooter>
    </>
  );
}
