# Plan 01: Replace hash.ts (Remove worldmonitor derivation)

## Goal

Replace the verbatim copy of worldmonitor's FNV-1a 52-bit hash with an independent implementation, removing the AGPL attribution requirement for this file.

## Context

`packages/server/src/lib/hash.ts` is a direct copy of worldmonitor's `server/_shared/hash.ts` — the header explicitly says "No functional changes." This is the clearest case of code derivation in the project.

FNV-1a is a **public domain algorithm** — anyone can implement it from the published spec. The issue is that our implementation was copied rather than independently written.

## Callers

- `ingest-feeds.ts` — dedup by `hashString(url + title)`
- `ingest-safety.ts` — dedup police reports
- `ingest-transit.ts` — dedup transit alerts
- `summarize.ts` — headline change detection
- `ingest-safety.test.ts`, `ingest-feeds.test.ts`, `summarize.test.ts` — test helpers

All callers use `hashString(input: string): string` — the signature must stay the same.

## Decision

Use Node.js built-in `crypto` module — SHA-256 truncated to 12 hex chars. Zero dependencies, deterministic, collision-safe at our scale.

```ts
import { createHash } from 'node:crypto';
export function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}
```

## Steps

1. Rewrite `packages/server/src/lib/hash.ts` using Option A (crypto)
2. Replace the attribution header with the standard new-code header
3. Run existing tests — `hash.ts` has no dedicated test file, but callers' tests exercise it
4. Verify the hashes are deterministic (same input → same output across runs)

## Notes

- Hash values will change, but that's fine — hashes are only used for in-memory dedup and cache keys, not persisted long-term
- The DB stores news item `id` fields which are `hashString(url + title)` — after deploying, old DB rows will have old hashes and new ingestion will generate new ones. The dedup logic in `ingest-feeds.ts` compares by `id`, so there may be temporary duplicates until old items age out. This is acceptable.
