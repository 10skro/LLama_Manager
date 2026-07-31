import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { getThemeById, applyTheme } from '@/themes';
import { DEFAULT_FONT_FAMILY } from '@/fonts';
import { persistThemeChange } from '@/services/settings';

export function useTheme() {
  const { activeTheme, settings, setActiveTheme } = useAppStore();
  const initialMount = useRef(true);

  useEffect(() => {
    console.log(
      '[THEME-BOOT] ⑦ useTheme effect: activeTheme=',
      activeTheme,
      'initialMount=',
      initialMount.current
    );
    const theme = getThemeById(activeTheme);
    if (theme) {
      applyTheme(theme);
    }

    // Skip persist on initial mount — the store starts with DEFAULT_THEME_ID,
    // and getSettings() will load the real saved theme from the DB.
    // Only persist when the user actively changes the theme (subsequent updates).
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }

    persistThemeChange(activeTheme).catch((err) => {
      console.error('Failed to persist theme change:', err);
    });
  }, [activeTheme]);

  // Apply font when settings.font_family changes
  useEffect(() => {
    const fontFamily = settings?.font_family ?? DEFAULT_FONT_FAMILY;
    document.documentElement.style.setProperty('--custom-font', fontFamily);
  }, [settings?.font_family]);

  return { activeTheme, setActiveTheme };
}
