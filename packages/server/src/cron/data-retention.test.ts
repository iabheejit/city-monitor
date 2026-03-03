/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  lt: vi.fn((col, val) => ({ op: 'lt', col, val })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
}));

import { createDataRetention } from './data-retention.js';
import type { Db } from '../db/index.js';

function createMockDb() {
  const where = vi.fn().mockResolvedValue([]);
  const deleteFn = vi.fn().mockReturnValue({ where });
  return {
    db: { delete: deleteFn } as unknown as Db,
    deleteFn,
    where,
  };
}

describe('data-retention', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T12:00:00Z'));
  });

  it('cleans up all tables', async () => {
    const mock = createMockDb();
    const handler = createDataRetention(mock.db);
    await handler();

    // 20 delete calls (one per table)
    expect(mock.deleteFn).toHaveBeenCalledTimes(20);
    expect(mock.where).toHaveBeenCalledTimes(20);
  });

  it('runs without errors when DB is empty', async () => {
    const mock = createMockDb();
    const handler = createDataRetention(mock.db);
    await expect(handler()).resolves.not.toThrow();
  });

  it('continues cleanup even if one table fails', async () => {
    const where = vi.fn()
      .mockResolvedValueOnce([])    // first table OK
      .mockRejectedValueOnce(new Error('DB error')) // second table fails
      .mockResolvedValue([]);       // rest OK
    const deleteFn = vi.fn().mockReturnValue({ where });
    const db = { delete: deleteFn } as unknown as Db;

    const handler = createDataRetention(db);
    await expect(handler()).resolves.not.toThrow();
    expect(deleteFn).toHaveBeenCalledTimes(20);
  });
});
