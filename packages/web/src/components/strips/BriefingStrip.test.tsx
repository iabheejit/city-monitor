import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { CityProvider } from '../../hooks/CityProvider.js';
import { BriefingStrip } from './BriefingStrip.js';
import type { NewsSummaryData, ApiResponse } from '@city-monitor/shared';

function createWrapper(options?: { summary?: ApiResponse<NewsSummaryData> }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  if (options?.summary) {
    queryClient.setQueryData(['news', 'summary', 'berlin', 'en'], options.summary);
  }

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CityProvider cityId="berlin">{children}</CityProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('BriefingStrip', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Mock fetch to never resolve (prevents real network calls, simulates loading)
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
  });

  it('renders skeleton when loading', () => {
    render(<BriefingStrip />, { wrapper: createWrapper() });
    expect(screen.getByTestId('skeleton')).toBeTruthy();
  });

  it('renders briefing text with paragraph splitting', () => {
    const summary: ApiResponse<NewsSummaryData> = {
      data: {
        briefing: 'First paragraph about transit.\n\nSecond paragraph about weather.',
        generatedAt: '2026-03-17T10:00:00Z',
        headlineCount: 12,
        cached: false,
      },
      fetchedAt: '2026-03-17T10:05:00Z',
    };

    render(<BriefingStrip />, { wrapper: createWrapper({ summary }) });
    expect(screen.getByText('First paragraph about transit.')).toBeTruthy();
    expect(screen.getByText('Second paragraph about weather.')).toBeTruthy();
  });

  it('renders empty message when briefing is null', () => {
    const summary: ApiResponse<NewsSummaryData> = {
      data: {
        briefing: null,
        generatedAt: null,
        headlineCount: 0,
        cached: false,
      },
      fetchedAt: '2026-03-17T10:05:00Z',
    };

    render(<BriefingStrip />, { wrapper: createWrapper({ summary }) });
    expect(screen.getByText('No articles available')).toBeTruthy();
  });

  it('renders error fallback on fetch error', async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CityProvider cityId="berlin">{children}</CityProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    render(<BriefingStrip />, { wrapper: Wrapper });

    // Wait for the error state to appear (longer timeout — useNewsSummary has retry: 1)
    const errorText = await screen.findByText(/Failed to load Briefing/, {}, { timeout: 5000 });
    expect(errorText).toBeTruthy();
  });
});
