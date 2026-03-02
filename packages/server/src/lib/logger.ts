/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string, err?: unknown): void;
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

function truncateUrl(url: string, maxLen = 80): string {
  return url.length > maxLen ? url.slice(0, maxLen) + '…' : url;
}

export function createLogger(tag: string): Logger {
  const prefix = () => `${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')} [${tag}]`;

  return {
    info(msg: string) {
      console.log(`${prefix()} ${msg}`);
    },

    warn(msg: string) {
      console.warn(`${prefix()} WARN: ${msg}`);
    },

    error(msg: string, err?: unknown) {
      console.error(`${prefix()} ERROR: ${msg}`);
      if (err !== undefined) console.error(err);
    },

    async fetch(url: string, init?: RequestInit): Promise<Response> {
      const start = performance.now();
      const display = truncateUrl(url);
      try {
        const response = await globalThis.fetch(url, init);
        const ms = Math.round(performance.now() - start);
        if (response.ok) {
          console.log(`${prefix()} FETCH ${display} → ${response.status} (${ms}ms)`);
        } else {
          console.warn(`${prefix()} FETCH ${display} → ${response.status} (${ms}ms)`);
        }
        return response;
      } catch (err) {
        const ms = Math.round(performance.now() - start);
        console.error(`${prefix()} FETCH ${display} → ERROR (${ms}ms)`);
        throw err;
      }
    },
  };
}
