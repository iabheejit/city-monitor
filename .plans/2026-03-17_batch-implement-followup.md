# Batch Implement — Follow-up (Plans 25-32)

## Controversial Decisions
Items where the agent made a judgment call the user should review.

- **Plan 25**: Used `@ts-expect-error` for `wb.xlsx.load()` call because ExcelJS type definitions declare `load(buffer: Buffer)` but Node 22+ `Buffer.from()` returns `Buffer<ArrayBuffer>` which is structurally incompatible with the old `Buffer` type. This is a known ExcelJS typing issue; the code works correctly at runtime. Will resolve itself when ExcelJS updates their type definitions.
- **Plan 31**: Put DB fallback tests in separate files (e.g. `weather-db-fallback.test.ts`) rather than adding describe blocks to existing test files. Reason: `vi.mock` is hoisted to the top level and would interfere with the existing `createApp`-based tests that rely on real (unmocked) module imports. Separate files keep test isolation clean.
- **Plan 31**: Used `node:http` for test HTTP requests in `weather-tiles.test.ts` instead of `globalThis.fetch`, because the test needs to mock `globalThis.fetch` (which `weather-tiles.ts` calls internally) while still making real HTTP requests to the test server.

## Skipped Items
Opportunities identified but not acted on, with reasons.

## User Input Needed
Questions that blocked progress on specific items.

## DB Migrations
Schema changes that need to be applied.

## Files to Delete
Files that should be removed (agent does not delete files autonomously).

## Implementation Issues
Problems encountered during execution.

## Borderline Insights
Findings that might warrant persisting to the project's knowledge system.

## Suggested Follow-Up Work
Potential new work items that emerged during execution.
