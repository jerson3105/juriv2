import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

const applyTheme = (resolved: 'light' | 'dark') => {
  if (typeof document !== 'undefined') {
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
};

// Aplicar tema inicial inmediatamente para evitar parpadeo
const storedTheme = typeof localStorage !== 'undefined' 
  ? JSON.parse(localStorage.getItem('juried-theme') || '{}')?.state?.theme 
  : null;
const initialTheme = storedTheme || 'light';
const initialResolved = initialTheme === 'system' ? getSystemTheme() : initialTheme;
applyTheme(initialResolved);

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: initialTheme as Theme,
      resolvedTheme: initialResolved,
      setTheme: (theme: Theme) => {
        const resolved = theme === 'system' ? getSystemTheme() : theme;
        applyTheme(resolved);
        set({ theme, resolvedTheme: resolved });
      },
    }),
    {
      name: 'juried-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = state.theme === 'system' ? getSystemTheme() : state.theme;
          applyTheme(resolved);
          state.resolvedTheme = resolved;
        }
      },
    }
  )
);

// Listener para cambios en el tema del sistema
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const state = useThemeStore.getState();
    if (state.theme === 'system') {
      const newTheme = e.matches ? 'dark' : 'light';
      applyTheme(newTheme);
      useThemeStore.setState({ resolvedTheme: newTheme });
    }
  });
}
