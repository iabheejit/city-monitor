import { useTranslation } from 'react-i18next';
import { useCityConfig } from '../../hooks/useCityConfig.js';
import { useSfSafety } from '../../hooks/useSfSafety.js';
import { useFreshness } from '../../hooks/useFreshness.js';
import { Skeleton } from '../layout/Skeleton.js';
import { TileFooter } from '../layout/TileFooter.js';
import type { SfDispatchCall, SfFireEmsCall } from '../../lib/api.js';

const FRESH_MAX_AGE = 15 * 60 * 1000;
const COLLAPSED_ROWS = 5;

function priorityColor(priority: string): string {
  if (priority === 'A' || priority === '1') return 'text-red-600 dark:text-red-400';
  if (priority === 'B' || priority === '2') return 'text-orange-500 dark:text-orange-400';
  return 'text-gray-500 dark:text-gray-400';
}

function CallRow({ call }: { call: SfDispatchCall }) {
  const time = call.createdAt ? new Date(call.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <div className="flex items-start gap-2 py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className={`shrink-0 text-xs font-bold w-5 text-center mt-0.5 ${priorityColor(call.priority)}`}>
        {call.priority || '—'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{call.callType}</p>
        <p className="text-xs text-gray-400 truncate">{call.address}{call.district ? ` · ${call.district}` : ''}</p>
      </div>
      {time && <span className="shrink-0 text-xs text-gray-400 tabular-nums">{time}</span>}
    </div>
  );
}

function FireRow({ call }: { call: SfFireEmsCall }) {
  const time = call.receivedDtTm ? new Date(call.receivedDtTm).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <div className="flex items-start gap-2 py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="shrink-0 text-base">🚒</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{call.callType}</p>
        <p className="text-xs text-gray-400 truncate">{call.address}{call.neighborhood ? ` · ${call.neighborhood}` : ''}</p>
      </div>
      {time && <span className="shrink-0 text-xs text-gray-400 tabular-nums">{time}</span>}
    </div>
  );
}

export function SfSafetyStrip({ expanded = false }: { expanded?: boolean }) {
  const { id: cityId } = useCityConfig();
  const { data, fetchedAt, isLoading, isError } = useSfSafety(cityId);
  const { t } = useTranslation();
  const { isStale, agoText } = useFreshness(fetchedAt, FRESH_MAX_AGE);

  if (isLoading) return <Skeleton lines={4} />;
  if (isError || !data) {
    return <p className="text-sm text-gray-400 py-2 text-center">{t('panel.sfSafety.empty')}</p>;
  }

  const lawCalls = data.lawEnforcement.slice(0, expanded ? 50 : COLLAPSED_ROWS);
  const fireCalls = data.fireEms.slice(0, expanded ? 20 : 2);
  const totalLaw = data.lawEnforcement.length;
  const totalFire = data.fireEms.length;

  return (
    <>
      <div className="flex gap-4 mb-2">
        <div className="flex-1 text-center">
          <div className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">{totalLaw}</div>
          <div className="text-xs text-gray-500">{t('panel.sfSafety.lawCalls')}</div>
        </div>
        <div className="flex-1 text-center">
          <div className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{totalFire}</div>
          <div className="text-xs text-gray-500">{t('panel.sfSafety.fireCalls')}</div>
        </div>
      </div>

      <div className="flex-1">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
          {t('panel.sfSafety.law')}
        </p>
        {lawCalls.map((c, i) => <CallRow key={i} call={c} />)}
        {!expanded && totalLaw > COLLAPSED_ROWS && (
          <p className="text-xs text-gray-400 text-center pt-1">+{totalLaw - COLLAPSED_ROWS} {t('panel.sfSafety.more')}</p>
        )}

        {fireCalls.length > 0 && (
          <>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 mt-3 uppercase tracking-wide">
              {t('panel.sfSafety.fire')}
            </p>
            {fireCalls.map((c, i) => <FireRow key={i} call={c} />)}
          </>
        )}
      </div>

      <TileFooter stale={isStale}>
        {t('panel.sfSafety.source')}{agoText ? ` · ${agoText}` : ''}
      </TileFooter>
    </>
  );
}
