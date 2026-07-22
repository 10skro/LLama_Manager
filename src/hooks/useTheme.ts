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

  // Apply font when settings.fontFamily changes
  useEffect(() => {
    const fontFamily = settings?.fontFamily ?? DEFAULT_FONT_FAMILY;
    document.documentElement.style.setProperty('--custom-font', fontFamily);
  }, [settings?.fontFamily]);

  return { activeTheme, setActiveTheme };
}
