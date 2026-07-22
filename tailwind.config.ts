import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        sidebar: 'hsl(var(--sidebar))',
        // Catppuccin Mocha native colors
        rosewater: 'hsl(var(--rosewater))',
        flamingo: 'hsl(var(--flamingo))',
        pink: 'hsl(var(--pink))',
        mauve: 'hsl(var(--mauve))',
        maroon: 'hsl(var(--maroon))',
        peach: 'hsl(var(--peach))',
        yellow: 'hsl(var(--yellow))',
        green: 'hsl(var(--green))',
        teal: 'hsl(var(--teal))',
        sky: 'hsl(var(--sky))',
        sapphire: 'hsl(var(--sapphire))',
        lavender: 'hsl(var(--lavender))',
        red: 'hsl(var(--red))',
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          0: 'hsl(var(--surface-0))',
          1: 'hsl(var(--surface-1))',
          2: 'hsl(var(--surface-2))',
        },
        overlay: {
          DEFAULT: 'hsl(var(--overlay))',
          0: 'hsl(var(--overlay-0))',
          1: 'hsl(var(--overlay-1))',
          2: 'hsl(var(--overlay-2))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
