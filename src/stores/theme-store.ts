import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeMode = 'jarvis' | 'hyundai';

interface ThemeStore {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (t: ThemeMode) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'jarvis',
      toggleTheme: () => set({ theme: get().theme === 'jarvis' ? 'hyundai' : 'jarvis' }),
      setTheme: (t) => set({ theme: t }),
    }),
    { name: 'bizsys-theme' }
  )
);
