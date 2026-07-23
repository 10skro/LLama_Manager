import { CheckCircle2, Loader2 } from 'lucide-react';

interface BuildStatusBadgeProps {
  installed?: boolean;
  downloading?: boolean;
}

export function BuildStatusBadge({ installed, downloading }: BuildStatusBadgeProps) {
  if (installed) {
    return (
      <div className="flex items-center justify-center gap-1.5 text-emerald-400">
        <CheckCircle2 className="h-4 w-4" />
        <span className="text-xs">Installed</span>
      </div>
    );
  }
  if (downloading) {
    return (
      <div className="flex items-center justify-center gap-1.5 text-blue-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Downloading</span>
      </div>
    );
  }
  return null;
}
