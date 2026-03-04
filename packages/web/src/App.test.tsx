import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App.js';

describe('App', () => {
  it('redirects / to /berlin', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getAllByText('BERLIN').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders Berlin dashboard at /berlin', async () => {
    render(
      <MemoryRouter initialEntries={['/berlin']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getAllByText('BERLIN').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('News').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Briefing')).toBeDefined();
  });

  it('redirects /hamburg to /berlin (Hamburg disabled)', async () => {
    render(
      <MemoryRouter initialEntries={['/hamburg']}>
        <App />
      </MemoryRouter>,
    );
    // Hamburg is not active, so it redirects to / → /berlin
    await waitFor(() => {
      expect(screen.getAllByText('BERLIN').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('redirects unknown city to /berlin', async () => {
    render(
      <MemoryRouter initialEntries={['/unknown-city']}>
        <App />
      </MemoryRouter>,
    );
    // Should redirect unknown city → / → /berlin
    await waitFor(() => {
      expect(screen.getAllByText('BERLIN').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders theme toggle on dashboard', async () => {
    render(
      <MemoryRouter initialEntries={['/berlin']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /switch to (dark|light) mode/i })).toBeDefined();
    });
  });

  it('renders footer on dashboard', async () => {
    render(
      <MemoryRouter initialEntries={['/berlin']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Source Code')).toBeDefined();
      expect(screen.getByText('AGPL-3.0')).toBeDefined();
    });
  });
});
