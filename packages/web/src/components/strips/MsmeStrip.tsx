import { useTranslation } from 'react-i18next';
import { useCityConfig } from '../../hooks/useCityConfig.js';
import { useMsme } from '../../hooks/useMsme.js';
import { useFreshness } from '../../hooks/useFreshness.js';
import { StripErrorFallback } from '../ErrorFallback.js';
import { Skeleton } from '../layout/Skeleton.js';
import { TileFooter } from '../layout/TileFooter.js';

const FRESH_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

function formatLarge(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString('en-IN');
}

export function MsmeStrip() {
  const { id: cityId, dataSources } = useCityConfig();
  const hasMsme = Boolean(dataSources.msme);
  const { data, fetchedAt, isLoading, isError, refetch } = useMsme(cityId, hasMsme);
  const { t } = useTranslation();
  const { isStale, agoText } = useFreshness(fetchedAt, FRESH_MAX_AGE);

  if (!hasMsme) return null;
  if (isLoading) return <Skeleton lines={3} />;
  if (isError) return <StripErrorFallback domain="MSME" onRetry={refetch} />;
  if (!data) return <p className="text-sm text-gray-400 py-2 text-center">{t('panel.msme.empty')}</p>;

  return (
    <>
      <div className="flex flex-col gap-4 py-1">
        {/* Headline count */}
        <div className="flex flex-col items-center">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {t('panel.msme.totalRegistered')}
          </span>
          <span className="text-4xl font-extrabold tabular-nums leading-none text-blue-600 dark:text-blue-400 mt-1">
            {formatLarge(data.totalRegistered)}
          </span>
        </div>

        {/* Top sectors */}
        {data.topSectors.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              {t('panel.msme.topSectors')}
            </p>
            <div className="flex flex-col gap-1">
              {data.topSectors.slice(0, 5).map((sector) => {
                const pct = data.topSectors[0]
                  ? Math.round((sector.count / data.topSectors[0].count) * 100)
                  : 0;
                return (
                  <div key={sector.description} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 dark:text-gray-300 truncate min-w-0 flex-1">
                      {sector.description}
                    </span>
                    <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 shrink-0">
                      <div
                        className="bg-blue-500 dark:bg-blue-400 h-1.5 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400 w-10 text-right shrink-0">
                      {formatLarge(sector.count)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent registrations */}
        {data.recentRegistrations.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              {t('panel.msme.recentRegistrations')}
            </p>
            <div className="flex flex-col gap-1">
              {data.recentRegistrations.slice(0, 5).map((ent, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs text-gray-700 dark:text-gray-200 font-medium truncate flex-1 min-w-0">
                    {ent.name}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 whitespace-nowrap">
                    {ent.registrationDate.slice(0, 7)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <TileFooter stale={isStale}>
        {t('panel.msme.source')}{agoText ? ` · ${agoText}` : ''}
      </TileFooter>
    </>
  );
}
