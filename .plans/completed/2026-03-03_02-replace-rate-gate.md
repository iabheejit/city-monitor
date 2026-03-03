# Plan 02: Replace rate-gate.ts (Remove worldmonitor derivation)

## Goal

Replace the adapted serial rate-gate with an independent implementation, removing the AGPL attribution requirement for this file.

## Context

`packages/server/src/lib/rate-gate.ts` was adapted from worldmonitor's `yahooGate` in `server/_shared/constants.ts`. The pattern (serial promise queue with minimum gap) is trivial — ~15 lines of obvious code. But the current file carries an attribution header.

## Callers

Only used via the test file `rate-gate.test.ts`. Grep shows no production imports besides the test. It may be imported by future code or was intended for use but never wired up.

## Decision

Rewrite from scratch with a timestamp-based approach (no promise chaining):

```ts
export function createRateGate(minGapMs: number) {
  let next = 0;
  return async () => {
    const now = Date.now();
    if (now < next) await new Promise<void>(r => setTimeout(r, next - now));
    next = Date.now() + minGapMs;
  };
}
```

## Steps

1. Rewrite `packages/server/src/lib/rate-gate.ts` with the fresh implementation above
2. Replace the attribution header with the standard new-code header
3. Run `rate-gate.test.ts` — both existing tests should pass with the new implementation
4. Keep the same export signature: `createRateGate(minGapMs: number): () => Promise<void>`
