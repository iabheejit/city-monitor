import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCityConfig } from '../../hooks/useCityConfig.js';
import { useMandiPrices } from '../../hooks/useMandiPrices.js';
import { useFreshness } from '../../hooks/useFreshness.js';
import { StripErrorFallback } from '../ErrorFallback.js';
import { Skeleton } from '../layout/Skeleton.js';
import { TileFooter } from '../layout/TileFooter.js';
import type { MandiCommodity } from '../../lib/api.js';

const FRESH_MAX_AGE = 36 * 60 * 60 * 1000; // 36h (daily data)

function formatPrice(price: number): string {
  return `₹${price.toLocaleString('en-IN')}`;
}

const CommodityRow = memo(function CommodityRow({ commodity }: { commodity: MandiCommodity }) {
  return (
    <div className="flex items-center gap-2 min-w-0 py-0.5">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-700 dark:text-gray-300 truncate block">
          {commodity.name}
        </span>
        {commodity.variety && (
          <span className="text-xs text-gray-400 dark:text-gray-500 truncate block">
            {commodity.variety} · {commodity.market}
          </span>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
          {formatPrice(commodity.modalPrice)}
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
          {formatPrice(commodity.minPrice)}–{formatPrice(commodity.maxPrice)}
        </div>
      </div>
    </div>
  );
});

const COLLAPSED_ROWS = 3;

export function MandiStrip({ expanded = false }: { expanded?: boolean }) {
  const { id: cityId } = useCityConfig();
  const hasMandi = Boolean(useCityConfig().dataSources.agmarknet);
  const { data, fetchedAt, isLoading, isError, refetch } = useMandiPrices(cityId, hasMandi);
  const { t } = useTranslation();
  const { isStale, agoText } = useFreshness(fetchedAt, FRESH_MAX_AGE);

  if (!hasMandi) return null;
  if (isLoading) return <Skeleton lines={3} />;
  if (isError) return <StripErrorFallback domain="Mandi Prices" onRetry={refetch} />;
  if (!data || data.commodities.length === 0) {
    return <p className="text-sm text-gray-400 py-2 text-center">{t('panel.mandi.empty')}</p>;
  }

  const visible = expanded ? data.commodities : data.commodities.slice(0, COLLAPSED_ROWS);
  const unit = t('panel.mandi.unit');

  return (
    <>
      <div className="space-y-1 flex-1">
        <p className="text-xs text-gray-400 dark:text-gray-500 text-right mb-1">{unit}</p>
        {visible.map((c, i) => (
          <CommodityRow key={`${c.name}-${c.variety}-${c.market}-${i}`} commodity={c} />
        ))}
        {!expanded && data.commodities.length > COLLAPSED_ROWS && (
          <p className="text-xs text-gray-400 text-center pt-1">
            +{data.commodities.length - COLLAPSED_ROWS} {t('panel.mandi.more')}
          </p>
        )}
      </div>
      <TileFooter stale={isStale}>
        {t('panel.mandi.source')}
        {agoText && (' · ' + t('stale.updated', { time: agoText }))}
      </TileFooter>
    </>
  );
}
