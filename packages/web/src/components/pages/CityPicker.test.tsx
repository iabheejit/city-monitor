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

  it('renders a link for each active city', () => {
    render(
      <MemoryRouter>
        <CityPicker />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /berlin/i })).toBeDefined();
    // Hamburg is not active, so it should not appear
    expect(screen.queryByRole('link', { name: /hamburg/i })).toBeNull();
  });

  it('links point to /:cityId', () => {
    render(
      <MemoryRouter>
        <CityPicker />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /berlin/i }).getAttribute('href')).toBe('/berlin');
  });
});
