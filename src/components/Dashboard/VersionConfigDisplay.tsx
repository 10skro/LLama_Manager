import { Terminal } from 'lucide-react';
import type { VersionConfigLink } from '@/types';
import { getColorPalette } from '@/themes';
import { useAppStore } from '@/store/useAppStore';

interface VersionConfigDisplayProps {
  link: VersionConfigLink | null;
  configName?: string;
  configColor?: string;
}

/**
 * Resolve a color key (e.g. "red") to its hex value using the current theme's palette.
 * If the color is already a valid hex, returns it directly.
 */
function resolveColorHex(colorKey: string): string {
  if (!colorKey) return '';

  // If it's already a valid hex, use it directly
  if (/^#[0-9A-Fa-f]{6}$/.test(colorKey)) return colorKey;

  const palette = getColorPalette(useAppStore.getState().activeTheme);
  const match = palette.find((c) => c.key === colorKey);
  return match?.hex || '';
}

export function VersionConfigDisplay({ link, configName, configColor }: VersionConfigDisplayProps) {
  if (!link) {
    return null;
  }

  const resolvedColor = resolveColorHex(configColor ?? '');

  return (
    <div className="px-3 py-2 flex items-center gap-2 border-b border-border/30">
      <Terminal className="h-3.5 w-3.5 text-muted-foreground" aria-label="Custom config icon" />
      {resolvedColor && (
        <span
          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: resolvedColor }}
          aria-label={`Config color`}
        />
      )}
      <span className="text-xs font-medium text-foreground truncate">
        {configName ?? `Config #${link.config_id}`}
      </span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">
        Custom
      </span>
    </div>
  );
}
