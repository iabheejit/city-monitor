# Licensing & Attribution Rules

This project is derived from [World Monitor](https://github.com/ellie-xyb/worldmonitor) by Elie Habib (AGPL-3.0-only). The new repo is licensed **AGPL-3.0-or-later**.

## Per-File Attribution Headers

### Files adapted from worldmonitor

Every file that ports code or patterns from worldmonitor **must** include this header:

```typescript
/**
 * [Brief description of what this module does.]
 *
 * Adapted from World Monitor (AGPL-3.0)
 * Original: [path in worldmonitor, e.g. server/_shared/redis.ts]
 * Copyright (C) 2024-2026 Elie Habib
 *
 * Modifications:
 * - [What changed vs the original]
 * - [Another change]
 */
```

### Files with entirely new code

```typescript
/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
```

## Adapted Components

These worldmonitor files are being ported (see NOTICE for the full mapping):

| Original file | New location | Milestone |
|---|---|---|
| `server/_shared/redis.ts` | `packages/server/src/lib/cache.ts` | 02 |
| `server/_shared/hash.ts` | `packages/server/src/lib/hash.ts` | 02 |
| `server/_shared/constants.ts` (yahooGate) | `packages/server/src/lib/rate-gate.ts` | 02 |
| `server/worldmonitor/news/v1/_classifier.ts` | `packages/server/src/lib/classifier.ts` | 04 |
| `src/config/feeds.ts` | `packages/server/src/config/` | 04 |
| `server/worldmonitor/news/v1/summarize-article.ts` | `packages/server/src/lib/openai.ts` | 07 |
| `server/worldmonitor/news/v1/list-feed-digest.ts` | `packages/server/src/cron/ingest-feeds.ts` | 04 |

## Dashboard Footer (Section 13 compliance)

The frontend must include a visible footer link:

```
Source Code: github.com/[you]/city-monitor | Based on World Monitor by Elie Habib | AGPL-3.0
```

This satisfies AGPL Section 13 (source availability for network users).

## Rules

- The repo **must** stay AGPL-3.0 (or later) — cannot switch to MIT/Apache/BSD
- Original copyright notices must be preserved in adapted files
- Source code must be publicly available to all users of the deployed site
- NOTICE file must be kept up to date when new components are adapted
