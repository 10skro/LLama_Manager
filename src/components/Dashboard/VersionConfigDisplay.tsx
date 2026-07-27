import { Terminal } from 'lucide-react';
import type { VersionConfigLink } from '@/types';

interface VersionConfigDisplayProps {
  link: VersionConfigLink | null;
  configName?: string;
}

export function VersionConfigDisplay({ link, configName }: VersionConfigDisplayProps) {
  if (!link) {
    return null;
  }

  return (
    <div className="px-3 py-2 flex items-center gap-2 border-b border-border/30">
      <Terminal className="h-3.5 w-3.5 text-muted-foreground" aria-label="Custom config icon" />
      <span className="text-xs font-medium text-foreground truncate">
        {configName ?? `Config #${link.config_id}`}
      </span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">
        Custom
      </span>
    </div>
  );
}
