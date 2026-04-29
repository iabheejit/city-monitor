import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery, useIsDesktop } from './useMediaQuery.js';

describe('useMediaQuery', () => {
  it('returns false by default in jsdom', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 640px)'));
    expect(result.current).toBe(false);
  });

  it('subscribes and unsubscribes to matchMedia changes', () => {
    const listeners: Array<() => void> = [];
    const addSpy = vi.fn((_, cb: () => void) => { listeners.push(cb); });
    const removeSpy = vi.fn();

    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: addSpy,
      removeEventListener: removeSpy,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { unmount } = renderHook(() => useMediaQuery('(min-width: 640px)'));
    expect(addSpy).toHaveBeenCalledWith('change', expect.any(Function));

    unmount();
    expect(removeSpy).toHaveBeenCalledWith('change', expect.any(Function));

    vi.unstubAllGlobals();
  });

  it('reacts to matchMedia change events', () => {
    let currentMatches = false;
    const listeners: Array<() => void> = [];

    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: currentMatches,
      media: query,
      addEventListener: vi.fn((_, cb: () => void) => { listeners.push(cb); }),
      removeEventListener: vi.fn(),
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useMediaQuery('(min-width: 640px)'));
    expect(result.current).toBe(false);

    // Simulate resize crossing the breakpoint
    currentMatches = true;
    act(() => {
      listeners.forEach((cb) => cb());
    });
    expect(result.current).toBe(true);

    vi.unstubAllGlobals();
  });
});

describe('useIsDesktop', () => {
  it('returns false by default in jsdom', () => {
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(false);
  });
});
