// ─── Card theme tokens ───

export interface ColorOption {
  name: string;
  variable: string;
  label: string;
}

export const HEADER_COLORS: ColorOption[] = [
  { name: 'mauve', variable: 'hsl(var(--mauve))', label: 'Mauve' },
  { name: 'red', variable: 'hsl(var(--red))', label: 'Red' },
  { name: 'pink', variable: 'hsl(var(--pink))', label: 'Pink' },
  { name: 'peach', variable: 'hsl(var(--peach))', label: 'Peach' },
  { name: 'yellow', variable: 'hsl(var(--yellow))', label: 'Yellow' },
  { name: 'green', variable: 'hsl(var(--green))', label: 'Green' },
  { name: 'teal', variable: 'hsl(var(--teal))', label: 'Teal' },
  { name: 'blue', variable: 'hsl(var(--blue))', label: 'Blue' },
  { name: 'lavender', variable: 'hsl(var(--lavender))', label: 'Lavender' },
  { name: 'love', variable: 'hsl(var(--love))', label: 'Love' },
  { name: 'iris', variable: 'hsl(var(--iris))', label: 'Iris' },
  { name: 'pine', variable: 'hsl(var(--pine))', label: 'Pine' },
];

export const TEXT_COLORS: ColorOption[] = [
  { name: 'white', variable: '#ffffff', label: 'White' },
  { name: 'black', variable: '#000000', label: 'Black' },
];
