/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { createElement } from 'react';
import { useTranslation } from 'react-i18next';
import { TrainFront, Wind, Newspaper, ShieldAlert, TriangleAlert, Pill, Car, Landmark } from 'lucide';
import { useCommandCenter, type DataLayer, type PoliticalLayer } from '../../hooks/useCommandCenter.js';
import type { IconNode } from '../../lib/map-icons.js';

const LAYER_META: { layer: DataLayer; icon: IconNode; color: string }[] = [
  { layer: 'transit', icon: TrainFront as IconNode, color: '#f59e0b' },
  { layer: 'news', icon: Newspaper as IconNode, color: '#6366f1' },
  { layer: 'safety', icon: ShieldAlert as IconNode, color: '#f97316' },
  { layer: 'warnings', icon: TriangleAlert as IconNode, color: '#ef4444' },
  { layer: 'air-quality', icon: Wind as IconNode, color: '#50C878' },
  { layer: 'pharmacies', icon: Pill as IconNode, color: '#10b981' },
  { layer: 'traffic', icon: Car as IconNode, color: '#8b5cf6' },
  { layer: 'political', icon: Landmark as IconNode, color: '#64748b' },
];

const INACTIVE_COLOR = '#9ca3af';
const POLITICAL_LAYERS: PoliticalLayer[] = ['bezirke', 'bundestag', 'landesparlament'];

function LayerBadge({ icon, color, active }: { icon: IconNode; color: string; active: boolean }) {
  const size = active ? 26 : 22;
  const iconSize = active ? 15 : 13;
  return (
    <span className="inline-flex items-center justify-center shrink-0 w-[26px] h-[26px]">
      <span
        className="inline-flex items-center justify-center rounded transition-all"
        style={{ width: size, height: size, backgroundColor: active ? color : INACTIVE_COLOR }}
      >
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {icon.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
        </svg>
      </span>
    </span>
  );
}

export function DataLayerToggles() {
  const { t } = useTranslation();
  const singleView = useCommandCenter((s) => s.singleView);
  const toggleSingleView = useCommandCenter((s) => s.toggleSingleView);
  const activeLayers = useCommandCenter((s) => s.activeLayers);
  const toggleLayer = useCommandCenter((s) => s.toggleLayer);
  const politicalLayer = useCommandCenter((s) => s.politicalLayer);
  const setPoliticalLayer = useCommandCenter((s) => s.setPoliticalLayer);

  return (
    <div>
      <div className="flex items-center justify-end mb-2">
        <button
          onClick={toggleSingleView}
          aria-pressed={singleView}
          className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors"
        >
          <span className={singleView ? 'text-gray-700 dark:text-gray-200 font-medium' : ''}>
            {t('sidebar.viewMode.single')}
          </span>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <span className={!singleView ? 'text-gray-700 dark:text-gray-200 font-medium' : ''}>
            {t('sidebar.viewMode.multi')}
          </span>
        </button>
      </div>
      <div className="space-y-0.5">
        {LAYER_META.map(({ layer, icon, color }) => {
          const active = activeLayers.has(layer);
          return (
            <button
              key={layer}
              onClick={() => toggleLayer(layer)}
              className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-left ${
                active ? '' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              style={active ? { backgroundColor: `${color}18` } : undefined}
            >
              <LayerBadge icon={icon} color={color} active={active} />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {t(`sidebar.layers.${layer}`)}
              </span>
            </button>
          );
        })}
      </div>

      {activeLayers.has('political') && (
        <div className="flex gap-1 mt-1.5 pl-1">
          {POLITICAL_LAYERS.map((pl) => (
            <button
              key={pl}
              onClick={() => setPoliticalLayer(pl)}
              className={`text-[11px] leading-tight px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                politicalLayer === pl
                  ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {t(`sidebar.political.${pl}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
