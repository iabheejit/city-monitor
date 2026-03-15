import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { ScrollIndicator } from './ScrollIndicator';

describe('ScrollIndicator', () => {
  it('renders a button with aria-label "Scroll to dashboard"', () => {
    const ref = createRef<HTMLDivElement>();
    render(<ScrollIndicator targetRef={ref} />);

    expect(screen.getByRole('button', { name: 'Scroll to dashboard' })).toBeTruthy();
  });

  it('contains an SVG element', () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(<ScrollIndicator targetRef={ref} />);

    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('calls scrollIntoView on the target ref when clicked', () => {
    const div = document.createElement('div');
    div.scrollIntoView = vi.fn();
    const ref = { current: div };

    render(<ScrollIndicator targetRef={ref} />);

    fireEvent.click(screen.getByRole('button', { name: 'Scroll to dashboard' }));
    expect(div.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('does not throw when target ref is null and button is clicked', () => {
    const ref = createRef<HTMLDivElement>();
    render(<ScrollIndicator targetRef={ref} />);

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Scroll to dashboard' }))).not.toThrow();
  });
});
