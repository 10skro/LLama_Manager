export interface FontOption {
  id: string;
  name: string;
  cssFamily: string;
}

export const AVAILABLE_FONTS: FontOption[] = [
  { id: 'instrument-sans', name: 'Instrument Sans', cssFamily: 'Instrument Sans' },
  { id: 'space-grotesk', name: 'Space Grotesk', cssFamily: 'Space Grotesk' },
];

export const DEFAULT_FONT_FAMILY = 'Instrument Sans';

export function getFontById(id: string): FontOption | undefined {
  return AVAILABLE_FONTS.find((f) => f.id === id);
}

export function getFontByCssFamily(family: string): FontOption | undefined {
  return AVAILABLE_FONTS.find((f) => f.cssFamily === family);
}
