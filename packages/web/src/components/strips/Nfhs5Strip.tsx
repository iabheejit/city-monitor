import { useTranslation } from 'react-i18next';
import { useCityConfig } from '../../hooks/useCityConfig.js';
import { useNfhs5 } from '../../hooks/useNfhs5.js';
import { useFreshness } from '../../hooks/useFreshness.js';
import { StripErrorFallback } from '../ErrorFallback.js';
import { Skeleton } from '../layout/Skeleton.js';
import { TileFooter } from '../layout/TileFooter.js';

const FRESH_MAX_AGE = 90 * 24 * 60 * 60 * 1000; // NFHS-5 is a 2019-21 survey

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 text-center leading-tight">{label}</span>
      <span className={`text-lg font-bold tabular-nums mt-0.5 ${color}`}>{value}</span>
    </div>
  );
}

export function Nfhs5Strip() {
  const { id: cityId, dataSources } = useCityConfig();
  const hasNfhs5 = Boolean(dataSources.nfhs5);
  const { data, fetchedAt, isLoading, isError, refetch } = useNfhs5(cityId, hasNfhs5);
  const { t } = useTranslation();
  const { isStale, agoText } = useFreshness(fetchedAt, FRESH_MAX_AGE);

  if (!hasNfhs5) return null;
  if (isLoading) return <Skeleton lines={4} />;
  if (isError) return <StripErrorFallback domain="NFHS-5" onRetry={refetch} />;
  if (!data) return <p className="text-sm text-gray-400 py-2 text-center">{t('panel.nfhs5.empty')}</p>;

  const pct = (n: number) => `${n.toFixed(1)}%`;

  return (
    <>
      <div className="flex flex-col gap-4 py-1">
        <p className="text-xs text-gray-400 text-center">{t('panel.nfhs5.survey')}: {data.surveyRound}</p>

        {/* Child health */}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            {t('panel.nfhs5.childHealth')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Metric label={t('panel.nfhs5.institutionalBirths')} value={pct(data.institutionalBirths)} color="text-green-600 dark:text-green-400" />
            <Metric label={t('panel.nfhs5.childVaccinated')} value={pct(data.childFullyVaccinated)} color="text-blue-600 dark:text-blue-400" />
            <Metric label={t('panel.nfhs5.stunted')} value={pct(data.stuntedUnderFive)} color="text-orange-600 dark:text-orange-400" />
            <Metric label={t('panel.nfhs5.wasted')} value={pct(data.wastedUnderFive)} color="text-red-500 dark:text-red-400" />
          </div>
        </div>

        {/* Nutrition */}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            {t('panel.nfhs5.nutrition')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Metric label={t('panel.nfhs5.anaemicWomen')} value={pct(data.anaemicWomen)} color="text-rose-600 dark:text-rose-400" />
            <Metric label={t('panel.nfhs5.anaemicChildren')} value={pct(data.anaemicChildren)} color="text-rose-500 dark:text-rose-300" />
          </div>
        </div>

        {/* Household */}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            {t('panel.nfhs5.household')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Metric label={t('panel.nfhs5.drinkingWater')} value={pct(data.improvedDrinkingWater)} color="text-cyan-600 dark:text-cyan-400" />
            <Metric label={t('panel.nfhs5.sanitation')} value={pct(data.improvedSanitation)} color="text-teal-600 dark:text-teal-400" />
            <Metric label={t('panel.nfhs5.cleanFuel')} value={pct(data.cleanFuel)} color="text-lime-600 dark:text-lime-400" />
            <Metric label={t('panel.nfhs5.sexRatio')} value={data.sexRatio.toFixed(0)} color="text-purple-600 dark:text-purple-400" />
          </div>
        </div>
      </div>
      <TileFooter stale={isStale}>
        {t('panel.nfhs5.source')}
        {agoText && (' · ' + t('stale.updated', { time: agoText }))}
      </TileFooter>
    </>
  );
}
