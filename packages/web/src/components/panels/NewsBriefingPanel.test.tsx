/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { CityProvider } from '../../hooks/useCityConfig.js';
import { NewsBriefingPanel } from './NewsBriefingPanel.js';
import type { NewsDigest } from '../../lib/api.js';

const mockItems = [
  { id: '1', title: 'BVG Störung auf U2', url: 'https://example.com/1', publishedAt: new Date(Date.now() - 5 * 60_000).toISOString(), sourceName: 'rbb24', category: 'transit', tier: 1 },
  { id: '2', title: 'Berlinale Eröffnung', url: 'https://example.com/2', publishedAt: new Date(Date.now() - 30 * 60_000).toISOString(), sourceName: 'Tagesspiegel', category: 'culture', tier: 2 },
  { id: '3', title: 'Senat beschließt Haushalt', url: 'https://example.com/3', publishedAt: new Date(Date.now() - 60 * 60_000).toISOString(), sourceName: 'Morgenpost', category: 'politics', tier: 1 },
];

const mockDigest: NewsDigest = {
  items: mockItems,
  categories: {
    transit: [mockItems[0]],
    culture: [mockItems[1]],
    politics: [mockItems[2]],
  },
  updatedAt: '2026-03-01T10:00:00Z',
};

function createWrapper(digest?: NewsDigest) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  if (digest) {
    queryClient.setQueryData(['news', 'digest', 'berlin'], digest);
  }

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <CityProvider cityId="berlin">{children}</CityProvider>
    </QueryClientProvider>
  );
}

describe('NewsBriefingPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Prevent actual fetch calls
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ items: [], categories: {}, updatedAt: null }), { status: 200 }),
    );
  });

  it('renders news items when data is available', () => {
    render(<NewsBriefingPanel />, { wrapper: createWrapper(mockDigest) });

    expect(screen.getByText('BVG Störung auf U2')).toBeTruthy();
    expect(screen.getByText('Berlinale Eröffnung')).toBeTruthy();
    expect(screen.getByText('Senat beschließt Haushalt')).toBeTruthy();
  });

  it('shows category filter tabs', () => {
    render(<NewsBriefingPanel />, { wrapper: createWrapper(mockDigest) });

    expect(screen.getByRole('tab', { name: /all/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /transit/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /culture/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /politics/i })).toBeTruthy();
  });

  it('filters items when a category tab is clicked', () => {
    render(<NewsBriefingPanel />, { wrapper: createWrapper(mockDigest) });

    fireEvent.click(screen.getByRole('tab', { name: /transit/i }));

    expect(screen.getByText('BVG Störung auf U2')).toBeTruthy();
    expect(screen.queryByText('Berlinale Eröffnung')).toBeNull();
    expect(screen.queryByText('Senat beschließt Haushalt')).toBeNull();
  });

  it('shows all items when "All" tab is clicked after filtering', () => {
    render(<NewsBriefingPanel />, { wrapper: createWrapper(mockDigest) });

    fireEvent.click(screen.getByRole('tab', { name: /transit/i }));
    fireEvent.click(screen.getByRole('tab', { name: /all/i }));

    expect(screen.getByText('BVG Störung auf U2')).toBeTruthy();
    expect(screen.getByText('Berlinale Eröffnung')).toBeTruthy();
  });

  it('renders headline links with target="_blank"', () => {
    render(<NewsBriefingPanel />, { wrapper: createWrapper(mockDigest) });

    const link = screen.getByRole('link', { name: /BVG Störung auf U2/i });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('href')).toBe('https://example.com/1');
  });

  it('displays source names', () => {
    render(<NewsBriefingPanel />, { wrapper: createWrapper(mockDigest) });

    expect(screen.getByText('rbb24')).toBeTruthy();
    expect(screen.getByText('Tagesspiegel')).toBeTruthy();
  });

  it('shows skeleton when loading', () => {
    // Mock fetch to never resolve — keeps query in loading state
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <CityProvider cityId="berlin">{children}</CityProvider>
      </QueryClientProvider>
    );

    render(<NewsBriefingPanel />, { wrapper });

    expect(screen.getByTestId('skeleton')).toBeTruthy();
  });
});
