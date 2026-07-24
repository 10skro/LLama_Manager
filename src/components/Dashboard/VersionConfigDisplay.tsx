import { FileText, Terminal } from 'lucide-react';
import type { VersionConfigLink } from '@/types';

interface VersionConfigDisplayProps {
  link: VersionConfigLink | null;
  configName?: string;
}

export function VersionConfigDisplay({ link, configName }: VersionConfigDisplayProps) {
  if (!link) {
    return null;
  }

  const icon = link.config_type === 'launch'
    ? <FileText className="h-3.5 w-3.5" />
    : <Terminal className="h-3.5 w-3.5" />;

  const label = link.config_type === 'launch' ? 'Launch' : 'Custom';

  return (
    <div className="px-3 py-1.5 flex items-center gap-2 border-b border-border/30">
      <span className="text-muted-foreground" aria-label={`${label} config icon`}>{icon}</span>
      <span className="text-xs font-medium text-foreground truncate">
        {configName ?? `Config #${link.config_id}`}
      </span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">
        {label}
      </span>
    </div>
  );
}
