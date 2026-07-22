import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { getThemeById, applyTheme } from '@/themes';

export function useTheme() {
  const { activeTheme, setActiveTheme } = useAppStore();

  useEffect(() => {
    const theme = getThemeById(activeTheme);
    if (theme) {
      applyTheme(theme);
    }
  }, [activeTheme]);

  return { activeTheme, setActiveTheme };
}
