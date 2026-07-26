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
// Idempotent: ne modifie le DOM que si la valeur a réellement changé
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const computed = getComputedStyle(root);
  let hasChanges = false;

  for (const [key, value] of Object.entries(theme.cssVariables)) {
    const current = computed.getPropertyValue(key).trim();
    if (current !== value) {
      root.style.setProperty(key, value);
      hasChanges = true;
    }
  }

  // Track which theme is currently applied to avoid redundant work
  const currentThemeAttr = root.getAttribute('data-applied-theme');
  if (currentThemeAttr !== theme.id) {
    root.setAttribute('data-applied-theme', theme.id);
    hasChanges = true;
  }

  // Defer removal of the anti-flash style until AFTER the browser has painted
  // with the new CSS variables. This prevents a flash of wrong background color
  // when the inline !important style is removed before the CSS variables take effect.
  if (hasChanges) {
    requestAnimationFrame(() => {
      const initStyle = document.querySelector('style[data-theme-init]');
      if (initStyle) {
        initStyle.remove();
      }
    });
  }

  return hasChanges;
}
