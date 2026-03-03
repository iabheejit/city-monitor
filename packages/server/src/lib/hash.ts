/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { createHash } from 'node:crypto';

/** SHA-256 hash truncated to 12 hex characters for deterministic cache/dedup keys. */
export function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}
