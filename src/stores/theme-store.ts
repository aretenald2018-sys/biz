import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeMode = 'jarvis' | 'hyundai' | 'kia';

const THEME_CYCLE: ThemeMode[] = ['jarvis', 'hyundai', 'kia'];

interface ThemeStore {
  theme: ThemeMode;
  cycleTheme: () => void;
  setTheme: (t: ThemeMode) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'jarvis',
      cycleTheme: () => {
        const current = get().theme;
        const idx = THEME_CYCLE.indexOf(current);
        const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
        set({ theme: next });
      },
      setTheme: (t) => set({ theme: t }),
    }),
    { name: 'bizsys-theme' }
  )
);
