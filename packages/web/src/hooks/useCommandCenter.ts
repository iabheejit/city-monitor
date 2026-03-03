/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { create } from 'zustand';

export type DataLayer = 'transit' | 'weather' | 'news' | 'safety' | 'warnings' | 'air-quality' | 'pharmacies' | 'traffic' | 'political';
export type PoliticalLayer = 'bezirke' | 'bundestag' | 'landesparlament';

interface CommandCenterState {
  singleView: boolean;
  activeLayers: Set<DataLayer>;
  politicalLayer: PoliticalLayer;
  toggleSingleView: () => void;
  toggleLayer: (layer: DataLayer) => void;
  setPoliticalLayer: (layer: PoliticalLayer) => void;
}

const DEFAULT_LAYERS: Set<DataLayer> = new Set(['transit']);

export const useCommandCenter = create<CommandCenterState>((set) => ({
  singleView: true,
  activeLayers: new Set(DEFAULT_LAYERS),
  politicalLayer: 'bundestag',
  toggleSingleView: () =>
    set((state) => {
      const singleView = !state.singleView;
      if (singleView && state.activeLayers.size > 1) {
        const first = state.activeLayers.values().next().value as DataLayer;
        return { singleView, activeLayers: new Set<DataLayer>([first]) };
      }
      return { singleView };
    }),
  toggleLayer: (layer) =>
    set((state) => {
      if (state.singleView) {
        // In single-view mode: toggle off if already active, otherwise switch to this layer only
        if (state.activeLayers.has(layer) && state.activeLayers.size === 1) {
          return { activeLayers: new Set<DataLayer>() };
        }
        return { activeLayers: new Set<DataLayer>([layer]) };
      }
      const next = new Set(state.activeLayers);
      if (next.has(layer)) {
        next.delete(layer);
      } else {
        next.add(layer);
      }
      return { activeLayers: next };
    }),
  setPoliticalLayer: (layer) => set({ politicalLayer: layer }),
}));
