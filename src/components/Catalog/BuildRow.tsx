import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { getBackendColor } from '@/utils/backendColors';
import { formatDate, formatSize } from '@/utils/format';
import { BuildStatusBadge } from '@/components/BuildStatusBadge';
import { Star, Info, Download, Loader2 } from 'lucide-react';
import type { Build } from '@/types';

interface BuildRowProps {
  build: Build;
  isInstalled: boolean;
  isDownloading: boolean;
  isFavorited: boolean;
  isLast: boolean;
  onToggleFavorite: () => void;
  onShowChangelog: () => void;
  onDownload: () => void;
}

export function BuildRow({
  build,
  isInstalled,
  isDownloading,
  isFavorited,
  isLast,
  onToggleFavorite,
  onShowChangelog,
  onDownload,
}: BuildRowProps) {
  const connector = isLast ? '└─ ' : '│  ';

  return (
    <TableRow
      className={cn(
        "border-b border-border transition-colors hover:bg-muted/50",
        "border-border/30 hover:bg-secondary/30"
      )}
    >
      {/* Col 1: Build with tree connector */}
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1">
          <span className="font-mono text-sm text-muted-foreground">{connector}</span>
          <span className="font-mono text-sm font-medium">
            {build.build_number}
          </span>
        </div>
      </TableCell>
      {/* Col 2: Arch */}
      <TableCell className="text-center text-muted-foreground text-sm">
        {build.architecture}
      </TableCell>
      {/* Col 3: Backend */}
      <TableCell className="text-center">
        <div className="flex items-center justify-center">
          <Badge
            variant="outline"
            className={`border ${getBackendColor(build.backend)}`}
          >
            {build.backend}
          </Badge>
        </div>
      </TableCell>
      {/* Col 4: Date */}
      <TableCell className="text-center text-muted-foreground text-sm">
        {formatDate(build.published_at)}
      </TableCell>
      {/* Col 5: Size */}
      <TableCell className="text-center text-muted-foreground text-sm">
        {formatSize(build.file_size)}
      </TableCell>
      {/* Col 6: Status */}
      <TableCell className="text-center">
        <BuildStatusBadge installed={isInstalled} downloading={isDownloading} />
      </TableCell>
      {/* Col 7: Actions */}
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-2">
          <button
            aria-pressed={isFavorited}
            aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            disabled={!build.download_url}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={`hover:opacity-80 transition-opacity p-1 rounded hover:bg-secondary ${!build.download_url ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={!build.download_url ? 'Cannot favorite: no download URL' : (isFavorited ? 'Remove from favorites' : 'Add to favorites')}
          >
            <Star
              className={`h-4 w-4 ${isFavorited ? 'fill-[hsl(var(--yellow))] text-[hsl(var(--yellow))]' : 'fill-none text-muted-foreground'}`}
            />
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onShowChangelog();
            }}
            className="h-8 w-8 p-0"
            title="View changelog"
          >
            <Info className="h-4 w-4" />
          </Button>
          {isInstalled ? (
            <Button variant="secondary" size="sm" disabled className="w-[80px] justify-center">
              Installed
            </Button>
          ) : isDownloading ? (
            <Button variant="secondary" size="sm" disabled className="w-[80px] justify-center">
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              Downloading
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              className="w-[80px] justify-center"
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
