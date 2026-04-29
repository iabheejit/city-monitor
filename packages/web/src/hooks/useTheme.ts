import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggle: (event?: MouseEvent | React.MouseEvent) => void;
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(next: Theme, event?: MouseEvent | React.MouseEvent) {
  const root = document.documentElement;

  // Set circle-wipe origin from click position
  if (event) {
    root.style.setProperty('--toggle-x', `${event.clientX}px`);
    root.style.setProperty('--toggle-y', `${event.clientY}px`);
  }

  const apply = () => {
    if (next === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  // Use View Transitions API if available for circle-wipe effect
  if (typeof document !== 'undefined' && 'startViewTransition' in document) {
    (document as { startViewTransition: (cb: () => void) => void }).startViewTransition(apply);
  } else {
    apply();
  }
}

export const useTheme = create<ThemeState>((set) => ({
  theme: getInitialTheme(),
  toggle: (event) =>
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      applyTheme(next, event);
      return { theme: next };
    }),
}));
