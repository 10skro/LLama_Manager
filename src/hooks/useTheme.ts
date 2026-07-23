import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { getThemeById, applyTheme } from '@/themes';
import { DEFAULT_FONT_FAMILY } from '@/fonts';

export function useTheme() {
  const { activeTheme, settings, setActiveTheme } = useAppStore();

  useEffect(() => {
    const theme = getThemeById(activeTheme);
    if (theme) {
      applyTheme(theme);
    }
  }, [activeTheme]);

  // Apply font when settings.font_family changes
  useEffect(() => {
    const fontFamily = settings?.font_family ?? DEFAULT_FONT_FAMILY;
    document.documentElement.style.setProperty('--custom-font', fontFamily);
  }, [settings?.font_family]);

  return { activeTheme, setActiveTheme };
}
