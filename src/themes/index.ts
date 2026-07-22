// --- Interfaces (shared across all themes) ---

/**
 * Generic color palette — each theme defines its own native colors.
 */
export type ThemeColors = Record<string, string>;

/**
 * A theme definition with semantic CSS variable mappings.
 */
export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  cssVariables: Record<string, string>;
}

// --- Theme registry ---

import { catppuccinMocha } from './catppuccin-mocha';
import { rosepineDawn } from './rosepine-dawn';
import { rosepineMoon } from './rosepine-moon';

export { catppuccinMocha } from './catppuccin-mocha';
export { rosepineDawn } from './rosepine-dawn';
export { rosepineMoon } from './rosepine-moon';

export const AVAILABLE_THEMES: Theme[] = [catppuccinMocha, rosepineDawn, rosepineMoon];
export const DEFAULT_THEME_ID = 'catppuccin-mocha';

export function getThemeById(id: string): Theme | undefined {
  return AVAILABLE_THEMES.find(t => t.id === id);
}

// Applique les variables CSS du thème sur :root
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.cssVariables)) {
    root.style.setProperty(key, value);
  }
}
