import { Terminal } from 'lucide-react';
import type { VersionConfigLink } from '@/types';

interface VersionConfigDisplayProps {
  link: VersionConfigLink | null;
  configName?: string;
  configColor?: string;
}

export function VersionConfigDisplay({ link, configName, configColor }: VersionConfigDisplayProps) {
  if (!link) {
    return null;
  }

  return (
    <div className="px-3 py-2 flex items-center gap-2 border-b border-border/30">
      <Terminal className="h-3.5 w-3.5 text-muted-foreground" aria-label="Custom config icon" />
      {configColor && (
        <span
          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: configColor }}
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
