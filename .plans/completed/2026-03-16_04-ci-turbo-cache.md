# Plan: Add Turbo Cache to lint and test CI Jobs

**Type:** refactor
**Complexity:** simple

## Current State

`.github/workflows/ci.yml` has 4 jobs: `typecheck`, `lint`, `test`, `build`. The `typecheck` and `build` jobs include an `actions/cache@v4` step that caches the `.turbo` directory, keyed on OS + `package-lock.json` hash. The `lint` and `test` jobs are missing this cache step, so Turborepo cannot reuse cached task outputs across CI runs.

## Change

Add the same `actions/cache@v4` block to both `lint` and `test` jobs, inserted between `npm ci` and the run command (matching the pattern in `typecheck` and `build`).

The cache block to add:

```yaml
      - uses: actions/cache@v4
        with:
          path: .turbo
          key: turbo-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}
          restore-keys: turbo-${{ runner.os }}-
```

### lint job (insert after line 34, before `run: npm run lint`)

### test job (insert after line 45, before `run: npm test`)

## Files Affected

1. `.github/workflows/ci.yml` -- add cache step to `lint` and `test` jobs

## Notes

- All four jobs use the same cache key (`turbo-<os>-<lockfile-hash>`). This is intentional: Turbo stores per-task hashes inside `.turbo`, so all jobs can safely share one cache directory without collisions.
- No alternatives considered; this is a direct copy of the existing pattern.
