# Plan 06: Attribution cleanup (Remove "derived from" language)

## Goal

After plans 01–05 remove all derived code, update attribution from "Based on / derived from" to "Inspired by" throughout the project. License stays AGPL-3.0-or-later.

## Prerequisites

Plans 01–05 must be completed first. After those, no file in the codebase will contain code derived from worldmonitor.

## Decision: Keep AGPL-3.0

The license stays AGPL-3.0-or-later — no license change. The goal is only to remove the "derived work" / "Based on" language and the Elie Habib copyright, since no code will be derived anymore.

## Files to update

### 1. Remove attribution header from `openai.ts`

`packages/server/src/lib/openai.ts` carries an "Adapted from" header but is already independent (different SDK, prompts, features). Replace with standard header:
```ts
/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
```

(`rss-parser.ts` and `summarize.ts` headers are handled in plan 05.)

### 2. Update LICENSE file

- Remove Elie Habib copyright line and "Based on World Monitor" text
- Keep AGPL-3.0-or-later text
- Top of file becomes:
```
City Monitor — Real-time city dashboard
Copyright (C) 2026 Odin Mühlenbein

Inspired by World Monitor (https://worldmonitor.io)

This program is free software...
```

### 3. Update NOTICE file

Replace the adapted-components mapping:
```
City Monitor
============

Inspired by World Monitor (https://worldmonitor.io)
by Elie Habib.

All code is original work by Odin Mühlenbein.
```

### 4. Update Footer component

`packages/web/src/components/layout/Footer.tsx`:
- Change `t('footer.basedOn')` to `t('footer.inspiredBy')`
- Link to worldmonitor app website instead of GitHub repo

Update i18n files (4 languages):
- `en.json`: `"inspiredBy": "Inspired by World Monitor"`
- `de.json`: `"inspiredBy": "Inspiriert von World Monitor"`
- `tr.json`: `"inspiredBy": "World Monitor'den ilham alınmıştır"`
- `ar.json`: `"inspiredBy": "مستوحى من World Monitor"`

Footer link href: `https://worldmonitor.io` (app website, not GitHub)

### 5. Update .context/licensing.md

Rewrite to reflect the new state:
- Remove "derived from" language
- Remove adapted components table
- Remove per-file attribution header templates for adapted files
- Keep the standard new-code header template
- Document "Inspired by" acknowledgment
- Keep Section 13 requirements (still AGPL)

### 6. Delete worldmonitor reference directory

- Delete `.worldmonitor/` directory (already gitignored, but clean up disk)
- Remove `.worldmonitor` entry from `.gitignore`

## Steps

1. Remove attribution header from `openai.ts`
2. Update `LICENSE` top matter (keep AGPL text, remove "Based on", add "Inspired by")
3. Rewrite `NOTICE`
4. Update Footer component + 4 i18n JSON files
5. Rewrite `.context/licensing.md`
6. Delete `.worldmonitor/` and clean `.gitignore`
7. Run `npm run typecheck` and `npm run lint`
