import { useTranslation } from 'react-i18next';
import { useCityConfig } from '../../hooks/useCityConfig.js';
import { useJjm } from '../../hooks/useJjm.js';
import { useFreshness } from '../../hooks/useFreshness.js';
import { StripErrorFallback } from '../ErrorFallback.js';
import { Skeleton } from '../layout/Skeleton.js';
import { TileFooter } from '../layout/TileFooter.js';

const FRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 text-center leading-tight">{label}</span>
      <span className={`text-xl font-extrabold tabular-nums mt-0.5 ${color}`}>
        {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
      </span>
    </div>
  );
}

export function JjmStrip() {
  const { id: cityId, dataSources } = useCityConfig();
  const hasJjm = Boolean(dataSources.jjm);
  const { data, fetchedAt, isLoading, isError, refetch } = useJjm(cityId, hasJjm);
  const { t } = useTranslation();
  const { isStale, agoText } = useFreshness(fetchedAt, FRESH_MAX_AGE);

  if (!hasJjm) return null;
  if (isLoading) return <Skeleton lines={3} />;
  if (isError) return <StripErrorFallback domain="JJM" onRetry={refetch} />;
  if (!data) return <p className="text-sm text-gray-400 py-2 text-center">{t('panel.jjm.empty')}</p>;

  return (
    <>
      <div className="flex flex-col gap-4 py-1">
        <div className="flex flex-col items-center">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('panel.jjm.habitations')}</span>
          <span className="text-4xl font-extrabold tabular-nums leading-none text-blue-600 dark:text-blue-400 mt-1">
            {data.totalHabitations.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Stat label={t('panel.jjm.blocks')} value={data.totalBlocks} color="text-teal-600 dark:text-teal-400" />
          <Stat label={t('panel.jjm.panchayats')} value={data.totalPanchayats} color="text-green-600 dark:text-green-400" />
          <Stat label={t('panel.jjm.villages')} value={data.totalVillages} color="text-cyan-600 dark:text-cyan-400" />
        </div>

        {data.blocks.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              {t('panel.jjm.blockList')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {data.blocks.join(' · ')}
            </p>
          </div>
        )}
      </div>
      <TileFooter stale={isStale}>
        {t('panel.jjm.source')}
        {agoText && (' · ' + t('stale.updated', { time: agoText }))}
      </TileFooter>
    </>
  );
}
