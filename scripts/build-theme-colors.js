/**
 * Build script: generates theme-colors.json from the frontend theme definitions.
 * Run as part of the Vite build pipeline (pre-build step).
 *
 * Reads: src/themes/*.ts (theme definitions)
 * Writes: src-tauri/resources/theme-colors.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Read all theme files from src/themes/
const themesDir = join(root, 'src', 'themes');
const themeFiles = ['catppuccin-mocha.ts', 'rosepine-moon.ts', 'rosepine-dawn.ts'];

const themeColorsMap = {};

for (const file of themeFiles) {
  const filePath = join(themesDir, file);
  const content = readFileSync(filePath, 'utf-8');

  // Extract the theme ID from the export
  const idMatch = content.match(/id:\s*'([^']+)'/);
  if (!idMatch) {
    console.warn(`⚠️  No theme ID found in ${file}, skipping`);
    continue;
  }
  const themeId = idMatch[1];

  // Extract base and text colors from the colors object
  const baseMatch = content.match(/base:\s*'([^']+)'/);
  const textMatch = content.match(/text:\s*'([^']+)'/);

  if (!baseMatch || !textMatch) {
    console.warn(`⚠️  Missing base/text colors in ${file}, skipping`);
    continue;
  }

  themeColorsMap[themeId] = {
    base: baseMatch[1],
    text: textMatch[1],
  };
}

// Write the JSON file
const output = join(root, 'src-tauri', 'resources', 'theme-colors.json');
writeFileSync(output, JSON.stringify(themeColorsMap, null, 2) + '\n', 'utf-8');

console.log(`✅ theme-colors.json generated with ${Object.keys(themeColorsMap).length} themes`);
console.log(`   → ${output}`);
