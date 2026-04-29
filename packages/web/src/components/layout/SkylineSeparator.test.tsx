import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SkylineSeparator } from './SkylineSeparator';

describe('SkylineSeparator', () => {
  it('renders with aria-hidden="true" for berlin', () => {
    const { container } = render(<SkylineSeparator cityId="berlin" />);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders with aria-hidden="true" for hamburg', () => {
    const { container } = render(<SkylineSeparator cityId="hamburg" />);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders Berlin skyline with TV Tower ellipse elements', () => {
    const { container } = render(<SkylineSeparator cityId="berlin" />);

    const ellipses = container.querySelectorAll('ellipse');
    // TV Tower has 2 ellipses + Cathedral dome has 1 = 3
    expect(ellipses.length).toBeGreaterThanOrEqual(2);
  });

  it('renders Berlin skyline with Brandenburg Gate polygon', () => {
    const { container } = render(<SkylineSeparator cityId="berlin" />);

    const polygons = container.querySelectorAll('polygon');
    expect(polygons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders generic skyline for non-berlin cities (no ellipses or polygons)', () => {
    const { container } = render(<SkylineSeparator cityId="hamburg" />);

    const ellipses = container.querySelectorAll('ellipse');
    const polygons = container.querySelectorAll('polygon');
    expect(ellipses.length).toBe(0);
    expect(polygons.length).toBe(0);
  });

  it('renders an SVG element', () => {
    const { container } = render(<SkylineSeparator cityId="berlin" />);

    expect(container.querySelector('svg')).toBeTruthy();
  });
});
