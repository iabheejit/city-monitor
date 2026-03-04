import { describe, it, expect, vi, afterEach } from 'vitest';

describe('createDb', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns null when DATABASE_URL is not set', async () => {
    vi.stubEnv('DATABASE_URL', '');
    // Re-import to get fresh module
    const { createDb } = await import('./index.js');
    const db = createDb();
    expect(db).toBeNull();
  });
});
