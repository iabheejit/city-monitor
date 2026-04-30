const DEFAULT_API_ORIGIN = 'https://city-monitor-zsjy.onrender.com';

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/$/, '');
}

export function resolveApiBase(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const explicitOrigin = env?.VITE_API_ORIGIN?.trim();
  if (explicitOrigin) {
    return `${normalizeOrigin(explicitOrigin)}/api`;
  }

  // This Render static host currently lacks API rewrite rules.
  if (typeof window !== 'undefined' && window.location.hostname === 'city-monitor-web-cb4b.onrender.com') {
    return `${DEFAULT_API_ORIGIN}/api`;
  }

  return '/api';
}

export const API_BASE = resolveApiBase();
