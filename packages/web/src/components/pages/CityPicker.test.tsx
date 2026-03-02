/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CityPicker } from './CityPicker.js';

describe('CityPicker', () => {
  it('renders a heading', () => {
    render(
      <MemoryRouter>
        <CityPicker />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
  });

  it('renders a link for each city', () => {
    render(
      <MemoryRouter>
        <CityPicker />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /berlin/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /hamburg/i })).toBeDefined();
  });

  it('links point to /:cityId', () => {
    render(
      <MemoryRouter>
        <CityPicker />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /berlin/i }).getAttribute('href')).toBe('/berlin');
    expect(screen.getByRole('link', { name: /hamburg/i }).getAttribute('href')).toBe('/hamburg');
  });
});
