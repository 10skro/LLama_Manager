import type { Theme } from './index';

// Fonction pour convertir hex vers HSL string
function hexToHSL(hex: string): string {
  // Guard clause: validate hex format
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    console.warn(`Invalid hex color: ${hex}, using fallback`);
    return '0 0% 50%';
  }
  // Convert hex to rgb, then rgb to hsl, return "h s% l%"
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Définir les couleurs Catppuccin Mocha
const catppuccinMochaColors: Record<string, string> = {
  rosewater: '#f5e0dc',
  flamingo: '#f2cdcd',
  pink: '#f5c2e7',
  mauve: '#cba6f7',
  red: '#f38ba8',
  maroon: '#eba0ac',
  peach: '#fab387',
  yellow: '#f9e2af',
  green: '#a6e3a1',
  teal: '#94e2d5',
  sky: '#89dceb',
  sapphire: '#74c7ec',
  blue: '#89b4fa',
  lavender: '#b4befe',
  text: '#cdd6f4',
  subtext1: '#bac2de',
  subtext0: '#a6adc8',
  overlay2: '#9399b2',
  overlay1: '#7f849c',
  overlay0: '#6c7086',
  surface2: '#585b70',
  surface1: '#45475a',
  surface0: '#313244',
  base: '#1e1e2e',
  mantle: '#181825',
  crust: '#11111b',
};

export const catppuccinMocha: Theme = {
  id: 'catppuccin-mocha',
  name: 'Catppuccin Mocha',
  colors: catppuccinMochaColors,
  cssVariables: {
    '--background': hexToHSL(catppuccinMochaColors.base),
    '--foreground': hexToHSL(catppuccinMochaColors.text),
    '--card': hexToHSL(catppuccinMochaColors.mantle),
    '--card-foreground': hexToHSL(catppuccinMochaColors.subtext1),
    '--popover': hexToHSL(catppuccinMochaColors.mantle),
    '--popover-foreground': hexToHSL(catppuccinMochaColors.subtext1),
    '--primary': hexToHSL(catppuccinMochaColors.blue),
    '--primary-foreground': '0 0% 15%',
    '--secondary': hexToHSL(catppuccinMochaColors.surface1),
    '--secondary-foreground': hexToHSL(catppuccinMochaColors.text),
    '--muted': hexToHSL(catppuccinMochaColors.surface1),
    '--muted-foreground': hexToHSL(catppuccinMochaColors.overlay0),
    '--accent': hexToHSL(catppuccinMochaColors.mauve),
    '--accent-foreground': '0 0% 15%',
    '--destructive': hexToHSL(catppuccinMochaColors.red),
    '--destructive-foreground': '0 0% 15%',
    '--border': hexToHSL(catppuccinMochaColors.crust),
    '--input': hexToHSL(catppuccinMochaColors.crust),
    '--ring': hexToHSL(catppuccinMochaColors.blue),
    '--sidebar': '240 23% 11%',
    // Catppuccin native colors as CSS variables
    '--rosewater': hexToHSL(catppuccinMochaColors.rosewater),
    '--flamingo': hexToHSL(catppuccinMochaColors.flamingo),
    '--pink': hexToHSL(catppuccinMochaColors.pink),
    '--mauve': hexToHSL(catppuccinMochaColors.mauve),
    '--red': hexToHSL(catppuccinMochaColors.red),
    '--maroon': hexToHSL(catppuccinMochaColors.maroon),
    '--peach': hexToHSL(catppuccinMochaColors.peach),
    '--yellow': hexToHSL(catppuccinMochaColors.yellow),
    '--green': hexToHSL(catppuccinMochaColors.green),
    '--teal': hexToHSL(catppuccinMochaColors.teal),
    '--sky': hexToHSL(catppuccinMochaColors.sky),
    '--sapphire': hexToHSL(catppuccinMochaColors.sapphire),
    '--blue': hexToHSL(catppuccinMochaColors.blue),
    '--lavender': hexToHSL(catppuccinMochaColors.lavender),
    '--surface': hexToHSL(catppuccinMochaColors.surface1),
    '--surface-0': hexToHSL(catppuccinMochaColors.surface0),
    '--surface-1': hexToHSL(catppuccinMochaColors.surface1),
    '--surface-2': hexToHSL(catppuccinMochaColors.surface2),
    '--overlay': hexToHSL(catppuccinMochaColors.overlay0),
    '--overlay-0': hexToHSL(catppuccinMochaColors.overlay0),
    '--overlay-1': hexToHSL(catppuccinMochaColors.overlay1),
    '--overlay-2': hexToHSL(catppuccinMochaColors.overlay2),
  },
};
