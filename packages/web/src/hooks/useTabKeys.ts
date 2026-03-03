/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useCallback, useRef } from 'react';

/**
 * Keyboard handler for ARIA tabs pattern (arrow keys + Home/End).
 * Moves focus between tab buttons using roving tabindex.
 */
export function useTabKeys(count: number, activeIndex: number, onSelect: (i: number) => void) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const setTabRef = useCallback((index: number) => (el: HTMLButtonElement | null) => {
    tabRefs.current[index] = el;
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    let next = activeIndex;
    if (e.key === 'ArrowRight') next = (activeIndex + 1) % count;
    else if (e.key === 'ArrowLeft') next = (activeIndex - 1 + count) % count;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    else return;

    e.preventDefault();
    onSelect(next);
    tabRefs.current[next]?.focus();
  }, [count, activeIndex, onSelect]);

  return { setTabRef, onKeyDown };
}
