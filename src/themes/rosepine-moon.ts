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

// Définir les couleurs Rosé Pine Moon (15 couleurs officielles)
const rosepineMoonColors: Record<string, string> = {
  base: '#232136',
  surface: '#2a273f',
  overlay: '#393552',
  muted: '#6e6a86',
  subtle: '#908caa',
  text: '#e0def4',
  love: '#eb6f92',
  gold: '#f6c177',
  rose: '#ea9a97',
  pine: '#3e8fb0',
  foam: '#9ccfd8',
  iris: '#c4a7e7',
  'highlight-low': '#2a283e',
  'highlight-med': '#44415a',
  'highlight-high': '#56526e',
};

export const rosepineMoon: Theme = {
  id: 'rosepine-moon',
  name: 'Rosé Pine Moon',
  colors: rosepineMoonColors,
  cssVariables: {
    // Semantic mappings
    '--background': hexToHSL(rosepineMoonColors.base),
    '--foreground': hexToHSL(rosepineMoonColors.text),
    '--card': hexToHSL(rosepineMoonColors.surface),
    '--card-foreground': hexToHSL(rosepineMoonColors.subtle),
    '--popover': hexToHSL(rosepineMoonColors.surface),
    '--popover-foreground': hexToHSL(rosepineMoonColors.subtle),
    '--primary': hexToHSL(rosepineMoonColors.pine),
    '--primary-foreground': hexToHSL(rosepineMoonColors.surface),
    '--secondary': hexToHSL(rosepineMoonColors.overlay),
    '--secondary-foreground': hexToHSL(rosepineMoonColors.text),
    '--muted': hexToHSL(rosepineMoonColors.overlay),
    '--muted-foreground': hexToHSL(rosepineMoonColors.muted),
    '--accent': hexToHSL(rosepineMoonColors.iris),
    '--accent-foreground': hexToHSL(rosepineMoonColors.surface),
    '--destructive': hexToHSL(rosepineMoonColors.love),
    '--destructive-foreground': hexToHSL(rosepineMoonColors.surface),
    '--border': hexToHSL(rosepineMoonColors['highlight-med']),
    '--input': hexToHSL(rosepineMoonColors['highlight-low']),
    '--ring': hexToHSL(rosepineMoonColors.pine),
    '--sidebar': hexToHSL(rosepineMoonColors['highlight-low']),
    // Rosé Pine Moon native colors as CSS variables
    '--love': hexToHSL(rosepineMoonColors.love),
    '--gold': hexToHSL(rosepineMoonColors.gold),
    '--yellow': hexToHSL(rosepineMoonColors.gold),
    '--rose': hexToHSL(rosepineMoonColors.rose),
    '--pine': hexToHSL(rosepineMoonColors.pine),
    '--foam': hexToHSL(rosepineMoonColors.foam),
    '--iris': hexToHSL(rosepineMoonColors.iris),
    '--highlight-low': hexToHSL(rosepineMoonColors['highlight-low']),
    '--highlight-med': hexToHSL(rosepineMoonColors['highlight-med']),
    '--highlight-high': hexToHSL(rosepineMoonColors['highlight-high']),
    '--base': hexToHSL(rosepineMoonColors.base),
    '--surface': hexToHSL(rosepineMoonColors.surface),
    '--overlay': hexToHSL(rosepineMoonColors.overlay),
    '--muted-color': hexToHSL(rosepineMoonColors.muted),
    '--subtle': hexToHSL(rosepineMoonColors.subtle),
  },
};
