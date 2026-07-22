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

// Définir les couleurs Rosé Pine Dawn (15 couleurs officielles)
const rosepineDawnColors: Record<string, string> = {
  base: '#faf4ed',
  surface: '#fffaf3',
  overlay: '#f2e9e1',
  muted: '#9893a5',
  subtle: '#797593',
  text: '#464261',
  love: '#b4637a',
  gold: '#ea9d34',
  rose: '#d7827e',
  pine: '#286983',
  foam: '#56949f',
  iris: '#907aa9',
  'highlight-low': '#f4ede8',
  'highlight-med': '#dfdad9',
  'highlight-high': '#cecacd',
};

export const rosepineDawn: Theme = {
  id: 'rosepine-dawn',
  name: 'Rosé Pine Dawn',
  colors: rosepineDawnColors,
  cssVariables: {
    // Semantic mappings
    '--background': hexToHSL(rosepineDawnColors.base),
    '--foreground': hexToHSL(rosepineDawnColors.text),
    '--card': hexToHSL(rosepineDawnColors.surface),
    '--card-foreground': hexToHSL(rosepineDawnColors.subtle),
    '--primary': hexToHSL(rosepineDawnColors.pine),
    '--primary-foreground': hexToHSL(rosepineDawnColors.surface),
    '--secondary': hexToHSL(rosepineDawnColors.overlay),
    '--secondary-foreground': hexToHSL(rosepineDawnColors.text),
    '--muted': hexToHSL(rosepineDawnColors.overlay),
    '--muted-foreground': hexToHSL(rosepineDawnColors.muted),
    '--accent': hexToHSL(rosepineDawnColors.iris),
    '--accent-foreground': hexToHSL(rosepineDawnColors.surface),
    '--destructive': hexToHSL(rosepineDawnColors.love),
    '--destructive-foreground': hexToHSL(rosepineDawnColors.surface),
    '--border': hexToHSL(rosepineDawnColors['highlight-med']),
    '--input': hexToHSL(rosepineDawnColors['highlight-low']),
    '--ring': hexToHSL(rosepineDawnColors.pine),
    '--sidebar': hexToHSL(rosepineDawnColors['highlight-low']),
    // Rosé Pine Dawn native colors as CSS variables
    '--love': hexToHSL(rosepineDawnColors.love),
    '--gold': hexToHSL(rosepineDawnColors.gold),
    '--yellow': hexToHSL(rosepineDawnColors.gold),
    '--rose': hexToHSL(rosepineDawnColors.rose),
    '--pine': hexToHSL(rosepineDawnColors.pine),
    '--foam': hexToHSL(rosepineDawnColors.foam),
    '--iris': hexToHSL(rosepineDawnColors.iris),
    '--highlight-low': hexToHSL(rosepineDawnColors['highlight-low']),
    '--highlight-med': hexToHSL(rosepineDawnColors['highlight-med']),
    '--highlight-high': hexToHSL(rosepineDawnColors['highlight-high']),
    '--base': hexToHSL(rosepineDawnColors.base),
    '--surface': hexToHSL(rosepineDawnColors.surface),
    '--overlay': hexToHSL(rosepineDawnColors.overlay),
    '--muted-color': hexToHSL(rosepineDawnColors.muted),
    '--subtle': hexToHSL(rosepineDawnColors.subtle),
  },
};
