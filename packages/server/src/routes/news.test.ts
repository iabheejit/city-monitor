import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../app.js';

describe('News API', () => {
  let server: Server;
  let baseUrl: string;
  let appContext: Awaited<ReturnType<typeof createApp>>;

  beforeAll(async () => {
    appContext = await createApp({ skipScheduler: true });
    await new Promise<void>((resolve) => {
      server = appContext.app.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('GET /api/berlin/news/digest returns empty digest when no data', async () => {
    const res = await fetch(`${baseUrl}/api/berlin/news/digest`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.items).toEqual([]);
    expect(body.data.categories).toEqual({});
    expect(body.fetchedAt).toBeNull();
  });

  it('GET /api/berlin/news/digest returns cached digest', async () => {
    appContext.cache.set('berlin:news:digest', {
      items: [{ id: '1', title: 'Test', category: 'local' }],
      categories: { local: [{ id: '1', title: 'Test', category: 'local' }] },
      updatedAt: '2026-03-01T00:00:00Z',
    }, 60);

    const res = await fetch(`${baseUrl}/api/berlin/news/digest`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].title).toBe('Test');
    expect(typeof body.fetchedAt).toBe('string');
  });

  it('GET /api/unknown/news/digest returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/unknown/news/digest`);
    expect(res.status).toBe(404);
  });

});
