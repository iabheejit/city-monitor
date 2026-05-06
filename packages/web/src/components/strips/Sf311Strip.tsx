import { useTranslation } from 'react-i18next';
import { useCityConfig } from '../../hooks/useCityConfig.js';
import { useSf311 } from '../../hooks/useSf311.js';
import { useFreshness } from '../../hooks/useFreshness.js';
import { Skeleton } from '../layout/Skeleton.js';
import { TileFooter } from '../layout/TileFooter.js';
import type { Sf311Request } from '../../lib/api.js';

const FRESH_MAX_AGE = 60 * 60 * 1000;
const COLLAPSED_ROWS = 5;

const CATEGORY_ICONS: Record<string, string> = {
  'Street and Sidewalk Cleaning': '🧹',
  'Graffiti': '🖌️',
  'Pothole & Street Issues': '🕳️',
  'Abandoned Vehicle': '🚗',
  'Tree Maintenance': '🌳',
};

function requestIcon(category: string): string {
  return CATEGORY_ICONS[category] ?? '📋';
}

function RequestRow({ req }: { req: Sf311Request }) {
  const opened = req.opened ? new Date(req.opened).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  return (
    <div className="flex items-start gap-2 py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="shrink-0 text-base">{requestIcon(req.category)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{req.category}</p>
        {req.neighborhood && (
          <p className="text-xs text-gray-400 truncate">{req.neighborhood}</p>
        )}
      </div>
      {opened && <span className="shrink-0 text-xs text-gray-400">{opened}</span>}
    </div>
  );
}

export function Sf311Strip({ expanded = false }: { expanded?: boolean }) {
  const { id: cityId } = useCityConfig();
  const { data, fetchedAt, isLoading, isError } = useSf311(cityId);
  const { t } = useTranslation();
  const { isStale, agoText } = useFreshness(fetchedAt, FRESH_MAX_AGE);

  if (isLoading) return <Skeleton lines={4} />;
  if (isError || !data) {
    return <p className="text-sm text-gray-400 py-2 text-center">{t('panel.sf311.empty')}</p>;
  }

  const topCategories = (() => {
    const counts = new Map<string, number>();
    for (const r of data.requests) {
      counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));
  })();
  const visible = expanded ? data.requests : data.requests.slice(0, COLLAPSED_ROWS);

  return (
    <>
      <div className="flex gap-2 mb-3 flex-wrap">
        {topCategories.map((cat) => (
          <div key={cat.category} className="flex-1 min-w-[80px] text-center bg-gray-50 dark:bg-gray-800 rounded p-2">
            <div className="text-lg font-bold tabular-nums text-orange-600 dark:text-orange-400">{cat.count}</div>
            <div className="text-xs text-gray-500 truncate">{cat.category.split(' ')[0]}</div>
          </div>
        ))}
      </div>

      <div className="flex-1">
        {visible.map((r, i) => <RequestRow key={i} req={r} />)}
        {!expanded && data.requests.length > COLLAPSED_ROWS && (
          <p className="text-xs text-gray-400 text-center pt-1">
            +{data.requests.length - COLLAPSED_ROWS} {t('panel.sf311.more')}
          </p>
        )}
      </div>

      <TileFooter stale={isStale}>
        {t('panel.sf311.source')}{agoText ? ` · ${agoText}` : ''}
      </TileFooter>
    </>
  );
}
