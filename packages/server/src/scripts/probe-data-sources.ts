type ProbeStatus = 'LIVE_OK' | 'LIVE_EMPTY' | 'BROKEN' | 'REQUEST_ONLY_OR_GAP' | 'CSV_STATIC' | 'NEEDS_RESOURCE_ID';

import { writeFile } from 'node:fs/promises';

type DataGovProbeSpec = {
  id: string;
  name: string;
  kind: 'data-gov';
  resourceId: string;
  filters?: Record<string, string>;
  note?: string;
};

type UrlProbeSpec = {
  id: string;
  name: string;
  kind: 'url';
  url: string;
  note?: string;
};

type ProbeSpec = DataGovProbeSpec | UrlProbeSpec;

type ProbeResult = {
  id: string;
  name: string;
  endpoint: string;
  status: ProbeStatus;
  total: number | null;
  sampleFields: string[];
  message: string;
};

const DATA_GOV_BASE = 'https://api.data.gov.in/resource';
const TIMEOUT_MS = 20_000;

// First batch: known/likely API endpoints that can be checked automatically.
const PROBE_SPECS: ProbeSpec[] = [
  {
    id: 'agmarknet-mandi',
    name: 'Daily mandi crop prices (AGMARKNET)',
    kind: 'data-gov',
    resourceId: '9ef84268-d588-465a-a308-a864a43d0070',
    filters: { state: 'Maharashtra', district: 'Nagpur' },
  },
  {
    id: 'cpcb-realtime-aqi',
    name: 'Real-time AQI (CPCB CAAQMS)',
    kind: 'data-gov',
    resourceId: '3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69',
    filters: { city: 'Nagpur' },
  },
  {
    id: 'msme-udyam',
    name: 'MSME Udyam registrations',
    kind: 'data-gov',
    resourceId: '8b68ae56-84cf-4728-a0a6-1be11028dea7',
    filters: { District: 'NAGPUR' },
  },
  {
    id: 'mgnrega-gp',
    name: 'MGNREGA GP-wise employment data',
    kind: 'data-gov',
    resourceId: '9802de1b-1be5-4c1c-b247-aba9ee9b25d9',
    filters: { State_name: 'Maharashtra', District_Name: 'Nagpur' },
  },
  {
    id: 'myscheme-search',
    name: 'MyScheme catalogue API',
    kind: 'url',
    url: 'https://api.myscheme.gov.in/search/v4/schemes?lang=en&q=%5B%7B%22identifier%22%3A%22beneficiaryState%22%2C%22value%22%3A%22Maharashtra%22%7D%5D&from=0&size=5',
  },
];

function buildDataGovUrl(spec: DataGovProbeSpec, apiKey: string): string {
  const url = new URL(`${DATA_GOV_BASE}/${spec.resourceId}`);
  url.searchParams.set('api-key', apiKey);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '3');
  for (const [key, value] of Object.entries(spec.filters ?? {})) {
    url.searchParams.set(`filters[${key}]`, value);
  }
  return url.toString();
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'city-monitor-api-probe/1.0',
        Origin: 'https://www.myscheme.gov.in',
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function analyzeDataGovResponse(spec: DataGovProbeSpec, endpoint: string, data: unknown): ProbeResult {
  const d = (data ?? {}) as { status?: string; total?: number; records?: Array<Record<string, unknown>>; message?: string };
  if (d.status === 'error') {
    return {
      id: spec.id,
      name: spec.name,
      endpoint,
      status: 'BROKEN',
      total: d.total ?? null,
      sampleFields: [],
      message: d.message ?? 'API returned error status',
    };
  }

  const records = Array.isArray(d.records) ? d.records : [];
  const total = typeof d.total === 'number' ? d.total : records.length;
  const sampleFields = records[0] ? Object.keys(records[0]).slice(0, 12) : [];

  return {
    id: spec.id,
    name: spec.name,
    endpoint,
    status: total > 0 ? 'LIVE_OK' : 'LIVE_EMPTY',
    total,
    sampleFields,
    message: total > 0 ? 'Data available' : 'No records for current filters',
  };
}

function analyzeGenericResponse(spec: UrlProbeSpec, endpoint: string, data: unknown): ProbeResult {
  const d = (data ?? {}) as { data?: { hits?: { items?: unknown[] }; summary?: { total?: number } }; message?: string };
  const total = d.data?.summary?.total ?? d.data?.hits?.items?.length ?? 0;
  return {
    id: spec.id,
    name: spec.name,
    endpoint,
    status: total > 0 ? 'LIVE_OK' : 'LIVE_EMPTY',
    total,
    sampleFields: [],
    message: total > 0 ? 'Data available' : (d.message ?? 'No records'),
  };
}

async function probeOne(spec: ProbeSpec, apiKey: string): Promise<ProbeResult> {
  try {
    if (spec.kind === 'data-gov') {
      const endpoint = buildDataGovUrl(spec, apiKey);
      const data = await fetchJson(endpoint);
      return analyzeDataGovResponse(spec, endpoint, data);
    }

    const endpoint = spec.url;
    const data = await fetchJson(endpoint);
    return analyzeGenericResponse(spec, endpoint, data);
  } catch (err) {
    return {
      id: spec.id,
      name: spec.name,
      endpoint: spec.kind === 'data-gov' ? `${DATA_GOV_BASE}/${spec.resourceId}` : spec.url,
      status: 'BROKEN',
      total: null,
      sampleFields: [],
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

function toMarkdown(results: ProbeResult[]): string {
  const lines: string[] = [];
  lines.push('# Nagpur API Probe Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('| ID | Dataset | Status | Total | Notes |');
  lines.push('|---|---|---|---:|---|');
  for (const r of results) {
    const total = r.total === null ? '-' : String(r.total);
    lines.push(`| ${r.id} | ${r.name} | ${r.status} | ${total} | ${r.message.replace(/\|/g, '/')} |`);
  }

  lines.push('');
  lines.push('## Sample Fields');
  lines.push('');
  for (const r of results) {
    if (!r.sampleFields.length) continue;
    lines.push(`- ${r.id}: ${r.sampleFields.join(', ')}`);
  }

  lines.push('');
  lines.push('## Strategy Gate');
  lines.push('');
  lines.push('1. Probe endpoint health + filter behavior');
  lines.push('2. If LIVE_OK, implement server ingestion + read route + bootstrap field');
  lines.push('3. Add frontend tile with stale-data fallback');
  lines.push('4. Add tests for parser and route behavior');
  lines.push('5. Record final status in .plans tracker');
  return lines.join('\n');
}

async function main() {
  const apiKey = process.env.DATA_GOV_IN_API_KEY;
  if (!apiKey) {
    throw new Error('Missing DATA_GOV_IN_API_KEY in environment');
  }

  const results: ProbeResult[] = [];
  for (const spec of PROBE_SPECS) {
    const result = await probeOne(spec, apiKey);
    results.push(result);
    // Keep CLI output concise while still useful in CI logs.
    console.log(`${result.id}: ${result.status}${result.total !== null ? ` (total=${result.total})` : ''}`);
  }

  const markdown = toMarkdown(results);
  const outPath = '/Users/Shared/Scripts/city-monitor-1/.plans/2026-04-30_nagpur-api-probe-report.md';
  await writeFile(outPath, markdown, 'utf-8');
  console.log(`\nWrote report: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
