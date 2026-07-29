import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { getThemeById, applyTheme } from '@/themes';
import { useAppStore } from '@/store/useAppStore';
import { TerminalWidget } from './TerminalWidget';

export default function TerminalWidgetApp() {
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const activeTheme = useAppStore((s) => s.activeTheme);
  const setActiveTheme = useAppStore((s) => s.setActiveTheme);

  // Apply the initial theme on mount so CSS variables are fully set.
  // theme-init.js only sets a bare-bones anti-flash style; applyTheme() sets
  // all CSS variables needed by the widget UI and xterm.js.
  useEffect(() => {
    const theme = getThemeById(activeTheme);
    if (theme) {
      applyTheme(theme);
    }
  }, [activeTheme]);

  // Listen for theme changes from the main window and apply them
  useEffect(() => {
    listen<{ themeId: string }>('theme-changed', (event) => {
      const theme = getThemeById(event.payload.themeId);
      if (theme) {
        applyTheme(theme);
        // Update Zustand store so TerminalSessionItem reacts and re-themes xterm.js
        setActiveTheme(event.payload.themeId);
      }
    })
      .then((unlisten) => {
        unlistenRef.current = unlisten;
      })
      .catch(() => {});

    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, [setActiveTheme]);

  return <TerminalWidget />;
}
