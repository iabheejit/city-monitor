import { useTranslation } from 'react-i18next';
import { useCityConfig } from '../../hooks/useCityConfig.js';
import { useMgnrega } from '../../hooks/useMgnrega.js';
import { useFreshness } from '../../hooks/useFreshness.js';
import { StripErrorFallback } from '../ErrorFallback.js';
import { Skeleton } from '../layout/Skeleton.js';
import { TileFooter } from '../layout/TileFooter.js';

const FRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days (monthly data)

function formatCrore(rupees: number): string {
  const crore = rupees / 10_000_000;
  if (crore >= 100) return `₹${Math.round(crore).toLocaleString('en-IN')}Cr`;
  if (crore >= 1) return `₹${crore.toFixed(1)}Cr`;
  const lakh = rupees / 100_000;
  return `₹${lakh.toFixed(1)}L`;
}

function formatLarge(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString('en-IN');
}

export function MgnregaStrip() {
  const { id: cityId, dataSources } = useCityConfig();
  const hasMgnrega = Boolean(dataSources.mgnrega);
  const { data, fetchedAt, isLoading, isError, refetch } = useMgnrega(cityId, hasMgnrega);
  const { t } = useTranslation();
  const { isStale, agoText } = useFreshness(fetchedAt, FRESH_MAX_AGE);

  if (!hasMgnrega) return null;
  if (isLoading) return <Skeleton lines={3} />;
  if (isError) return <StripErrorFallback domain="MGNREGA" onRetry={refetch} />;
  if (!data) return <p className="text-sm text-gray-400 py-2 text-center">{t('panel.mgnrega.empty')}</p>;

  const spentPct = data.totalSanctioned > 0
    ? Math.min(100, Math.round((data.amountSpent / data.totalSanctioned) * 100))
    : 0;

  return (
    <>
      <div className="flex flex-col gap-4 py-1">
        {/* Person-days headline */}
        <div className="flex flex-col items-center">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {t('panel.mgnrega.personDays')}
          </span>
          <span className="text-4xl font-extrabold tabular-nums leading-none text-green-600 dark:text-green-400 mt-1">
            {formatLarge(data.personDaysGenerated)}
          </span>
          <span className="text-xs text-gray-400 mt-1">{data.financialYear}</span>
        </div>

        {/* Job cards and active workers */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 text-center">
              {t('panel.mgnrega.jobCards')}
            </span>
            <span className="text-xl font-bold tabular-nums text-blue-600 dark:text-blue-400 mt-0.5">
              {formatLarge(data.jobCardsIssued)}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 text-center">
              {t('panel.mgnrega.activeWorkers')}
            </span>
            <span className="text-xl font-bold tabular-nums text-teal-600 dark:text-teal-400 mt-0.5">
              {formatLarge(data.activeWorkers)}
            </span>
          </div>
        </div>

        {/* Expenditure */}
        <div className="flex flex-col items-center">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {t('panel.mgnrega.expenditure')}
          </span>
          <span className="text-2xl font-extrabold tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
            {formatCrore(data.amountSpent)}
          </span>
          {data.totalSanctioned > 0 && (
            <>
              <div className="w-full mt-1.5 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-amber-500"
                  style={{ width: `${spentPct}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 mt-1">
                {spentPct}% {t('panel.mgnrega.ofSanctioned')} ({formatCrore(data.totalSanctioned)})
              </span>
            </>
          )}
        </div>
      </div>
      <TileFooter stale={isStale}>
        {t('panel.mgnrega.source')}
        {agoText && (' · ' + t('stale.updated', { time: agoText }))}
      </TileFooter>
    </>
  );
}
