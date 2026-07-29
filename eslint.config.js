import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  // Global ignores
  {
    ignores: [
      'node_modules/**',
      'src-tauri/**',
      'dist/**',
      'build/**',
      'docs/**',
      'tailwind.config.ts',
    ],
  },

  // Base JavaScript recommended rules
  js.configs.recommended,

  // TypeScript recommended rules
  ...tseslint.configs.recommended,

  // Prettier - disable conflicting rules
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      ...prettierConfig.rules,
      'prettier/prettier': 'warn',
    },
  },

  // React Hooks + Refresh rules
  {
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'warn',
    },
  },

  // TypeScript specific config
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['*.config.ts', 'tailwind.config.ts', 'vite.config.ts', 'vitest.config.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Pre-existing issues — warn only, fix in dedicated PR
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
    },
  },

  // Node.js scripts and config files
  {
    files: ['*.config.{js,cjs,ts}', 'scripts/**/*.js', 'postcss.config.cjs'],
    languageOptions: {
      globals: {
        module: 'writable',
        require: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },

  // Browser scripts (public/)
  {
    files: ['public/**/*.js'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },

  // Suppress warnings for shadcn/ui and context files
  // These are library patterns (variant maps, context exports, empty interface extends)
  // that work fine in Tauri and are standard shadcn/ui conventions.
  {
    files: ['src/components/ui/*.tsx', 'src/components/Dashboard/*Context.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
];
