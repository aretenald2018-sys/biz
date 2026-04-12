import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeMode = 'hyundai';

interface ThemeStore {
  theme: ThemeMode;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    () => ({
      theme: 'hyundai',
    }),
    { name: 'bizsys-theme' }
  )
);
