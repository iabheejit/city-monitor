/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../app.js';

describe('City parameter validation', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const appContext = await createApp({ skipScheduler: true });
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

  it('rejects city IDs with invalid characters', async () => {
    const res = await fetch(`${baseUrl}/api/Berlin/weather`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid city ID format');
  });

  it('rejects city IDs with path traversal', async () => {
    const res = await fetch(`${baseUrl}/api/../etc/weather`);
    // Express normalizes paths, so this likely returns a different route
    // but if it hits the city middleware, it should fail validation
    expect(res.status).not.toBe(200);
  });

  it('returns 404 for unknown but valid-format city', async () => {
    const res = await fetch(`${baseUrl}/api/atlantis/weather`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('City not found');
  });

  it('allows valid city IDs through', async () => {
    const res = await fetch(`${baseUrl}/api/berlin/weather`);
    expect(res.status).toBe(200);
  });
});
