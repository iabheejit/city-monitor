/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { create } from 'zustand';

export type DataLayer = 'transit' | 'weather' | 'news' | 'safety' | 'warnings' | 'air-quality' | 'pharmacies' | 'traffic' | 'political';
export type PoliticalLayer = 'bezirke' | 'bundestag' | 'landesparlament';

interface CommandCenterState {
  activeLayers: Set<DataLayer>;
  politicalLayer: PoliticalLayer;
  toggleLayer: (layer: DataLayer) => void;
  setPoliticalLayer: (layer: PoliticalLayer) => void;
}

const DEFAULT_LAYERS: Set<DataLayer> = new Set(['transit']);

export const useCommandCenter = create<CommandCenterState>((set) => ({
  activeLayers: new Set(DEFAULT_LAYERS),
  politicalLayer: 'bundestag',
  toggleLayer: (layer) =>
    set((state) => {
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
