import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { getThemeById, applyTheme } from '@/themes';
import { useAppStore } from '@/store/useAppStore';
import { TerminalWidget } from './TerminalWidget';

export default function TerminalWidgetApp() {
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const setActiveTheme = useAppStore((s) => s.setActiveTheme);

  // Listen for theme changes from the main window and apply them
  useEffect(() => {
    listen<{ themeId: string }>('theme-changed', (event) => {
      const theme = getThemeById(event.payload.themeId);
      if (theme) {
        applyTheme(theme);
        // Update Zustand store so TerminalSessionItem reacts and re-themes xterm.js
        setActiveTheme(event.payload.themeId);
      }
    }).then((unlisten) => {
      unlistenRef.current = unlisten;
    }).catch(() => {});

    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, [setActiveTheme]);

  return <TerminalWidget />;
}
