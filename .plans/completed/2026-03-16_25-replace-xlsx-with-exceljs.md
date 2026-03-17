# Plan 25: Replace `xlsx` (SheetJS) with `exceljs`

**Type:** dependency migration (security fix)
**Complexity:** simple
**Status:** ready

## Motivation

The `xlsx` package at `^0.18.5` has unfixed high-severity CVEs and is abandoned on npm. It is used only for population XLSX parsing (Berlin demographics). `exceljs` is MIT-licensed, actively maintained, and provides equivalent functionality.

## Scope

3 files affected, 0 new files:

| File | Change |
|------|--------|
| `packages/server/package.json` | Remove `xlsx`, add `exceljs` |
| `packages/server/src/cron/ingest-population.ts` | Swap read/parse API |
| `packages/server/src/cron/ingest-population.test.ts` | Swap write/build API for test fixtures |

## API Mapping

### Production code (reading XLSX)

| `xlsx` (current) | `exceljs` (replacement) |
|---|---|
| `import * as XLSX from 'xlsx'` | `import ExcelJS from 'exceljs'` |
| `XLSX.read(new Uint8Array(buffer), { type: 'array' })` | `const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(buffer));` |
| `wb.Sheets['T2']` | `wb.getWorksheet('T2')` |
| `XLSX.utils.sheet_to_json(sheet, { header: 1 })` | Manual row iteration (see below) |

**`sheet_to_json` replacement:** ExcelJS does not have a direct `sheet_to_json({ header: 1 })` equivalent. Instead, iterate `worksheet.eachRow()` or use `worksheet.getSheetValues()` which returns an array of row arrays (1-indexed, first element is undefined). A small helper function will convert a worksheet to the same `unknown[][]` format the existing parse functions expect.

Helper approach:
```typescript
function sheetToAoa(ws: ExcelJS.Worksheet): unknown[][] {
  const rows: unknown[][] = [];
  ws.eachRow({ includeEmpty: true }, (_row, rowNumber) => {
    // ExcelJS rows are 1-indexed; _row.values is 1-indexed array (index 0 is undefined)
    const values = _row.values as unknown[];
    rows[rowNumber - 1] = values.slice(1); // Convert to 0-indexed
  });
  return rows;
}
```

This keeps `parseT2Sheet` and `parseSchluessel` and `extractSnapshotDate` function signatures unchanged -- they receive `unknown[][]` instead of a `XLSX.WorkSheet`, making the change minimal.

### Test code (writing XLSX)

| `xlsx` (current) | `exceljs` (replacement) |
|---|---|
| `XLSX.utils.book_new()` | `new ExcelJS.Workbook()` |
| `XLSX.utils.aoa_to_sheet(data)` | Build worksheet by adding rows (see below) |
| `XLSX.utils.book_append_sheet(wb, ws, name)` | `wb.addWorksheet(name)` + populate |
| `XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })` | `await wb.xlsx.writeBuffer()` |

Test helper approach:
```typescript
async function buildMockXlsx(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const schluesselWs = wb.addWorksheet('Schlüssel');
  for (const row of schluesselData) {
    schluesselWs.addRow(row);
  }
  const t2Ws = wb.addWorksheet('T2');
  for (const row of t2Data) {
    t2Ws.addRow(row);
  }
  const buf = await wb.xlsx.writeBuffer();
  return buf;
}
```

Note: `buildMockXlsx` becomes `async` since `exceljs` write is async. This cascades to the test setup but all tests already use `async` functions.

## Implementation Steps

1. **Install `exceljs`, remove `xlsx`**: Update `packages/server/package.json`. Run `npm install` from monorepo root.

2. **Update `ingest-population.ts`**:
   - Replace `import * as XLSX from 'xlsx'` with `import ExcelJS from 'exceljs'`
   - Add `sheetToAoa` helper function
   - Change `XLSX.read(...)` to `new ExcelJS.Workbook()` + `await wb.xlsx.load(Buffer.from(buffer))`
   - Change `wb.Sheets['T2']` to `wb.getWorksheet('T2')`
   - Change `parseT2Sheet(sheet)` / `parseSchluessel(sheet)` / `extractSnapshotDate(sheet)` to accept `unknown[][]` (the output of `sheetToAoa`) instead of `XLSX.WorkSheet`
   - Call `sheetToAoa(ws)` before passing to parse functions

3. **Update `ingest-population.test.ts`**:
   - Replace `import * as XLSX from 'xlsx'` with `import ExcelJS from 'exceljs'`
   - Rewrite `buildMockXlsx` to use ExcelJS API (becomes async)
   - Update all test calls from `buildMockXlsx()` to `await buildMockXlsx()`

4. **Update context doc** (`.context/population.md`): Change "Dependency: `xlsx` (SheetJS)" to "Dependency: `exceljs`".

5. **Run tests**: `npx turbo run test --filter=@city-monitor/server` to verify all 8 population tests pass.

6. **Typecheck**: `npx turbo run typecheck` to verify no type errors.

## Alternatives Considered

- **`xlsx-parse-json`** or other lightweight XLSX readers: Less mature, smaller community. `exceljs` is the de facto standard for Node XLSX work (10M+ weekly npm downloads, MIT license, active maintenance).
- **Keep `xlsx` and pin to a specific version**: The CVEs are unfixed and the package is abandoned; pinning doesn't help.
- **Use a streaming parser**: Overkill for a semi-annual 500KB file parsed in a cron job.

## Risks

- **Cell value types**: ExcelJS may return cell values with different types than SheetJS (e.g., numbers as numbers vs strings). The existing `parseSpaceNumber` function already handles both `number` and `string` inputs, so this should be safe. Tests will validate.
- **Empty rows**: ExcelJS `eachRow({ includeEmpty: true })` may handle sparse rows differently. The `sheetToAoa` helper normalizes this.
