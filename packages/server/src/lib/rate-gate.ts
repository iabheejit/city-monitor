/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Creates a rate gate that enforces a minimum time gap between calls.
 * Callers that arrive too early are delayed until the next allowed slot.
 */
export function createRateGate(minGapMs: number): () => Promise<void> {
  let next = 0;
  return async () => {
    const now = Date.now();
    if (now < next) {
      await new Promise<void>((r) => setTimeout(r, next - now));
    }
    next = Date.now() + minGapMs;
  };
}
