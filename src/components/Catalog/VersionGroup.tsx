import { Fragment } from 'react';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { getBackendColor } from '@/utils/backendColors';
import { formatDate } from '@/utils/format';
import { BuildStatusBadge } from '@/components/BuildStatusBadge';
import { ChevronDown } from 'lucide-react';
import { makeKey, getRowKey } from '@/utils/buildKey';
import { BuildRow } from './BuildRow';
import type { Build } from '@/types';

interface VersionGroupProps {
  buildNumber: string;
  variants: Build[];
  isExpanded: boolean;
  onToggle: () => void;
  installedKeys: Set<string>;
  downloadingKeys: Set<string>;
  favoriteKeys: Set<string>;
  onToggleFavorite: (build: Build) => void;
  onShowChangelog: (build: Build) => void;
  onDownload: (build: Build) => void;
}

export function VersionGroup({
  buildNumber,
  variants,
  isExpanded,
  onToggle,
  installedKeys,
  downloadingKeys,
  favoriteKeys,
  onToggleFavorite,
  onShowChangelog,
  onDownload,
}: VersionGroupProps) {
  const firstVariant = variants[0];
  const variantCount = variants.length;

  return (
    <Fragment>
      {/* Parent row - clickable to expand/collapse */}
      <TableRow
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${buildNumber} (${variantCount} variants)`}
        className="border-border/30 bg-secondary/20 hover:bg-secondary/40 cursor-pointer rounded"
        onClick={() => onToggle()}
      >
        {/* Col 1: Build */}
        <TableCell className="!py-3 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="font-mono text-sm font-bold">{buildNumber}</span>
            <Badge variant="secondary" className="text-xs">
              {variantCount} variant{variantCount > 1 ? 's' : ''}
            </Badge>
          </div>
        </TableCell>
        {/* Col 2: Arch (empty on parent) */}
        <TableCell className="text-center text-muted-foreground text-sm">—</TableCell>
        {/* Col 3: Backend */}
        <TableCell className="text-center">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {Array.from(new Set(variants.map(v => v.backend))).map((backend) => (
              <Badge
                key={backend}
                variant="outline"
                className={`text-xs border ${getBackendColor(backend)}`}
              >
                {backend}
              </Badge>
            ))}
          </div>
        </TableCell>
        {/* Col 4: Date */}
        <TableCell className="text-center text-muted-foreground text-sm">
          {formatDate(firstVariant.published_at)}
        </TableCell>
        {/* Col 5: Size (empty on parent - shown per-variant on children) */}
        <TableCell className="text-center"><span className="text-muted-foreground text-sm">—</span></TableCell>
        {/* Col 6: Status */}
        <TableCell className="text-center">
          <BuildStatusBadge
            installed={variants.some(v => installedKeys.has(makeKey(v.build_number, v.backend, v.architecture)))}
            downloading={variants.some(v => downloadingKeys.has(makeKey(v.build_number, v.backend, v.architecture)))}
          />
        </TableCell>
        {/* Col 7: Actions (empty on parent - actions moved to child rows) */}
        <TableCell className="text-center"><span className="text-muted-foreground text-sm">—</span></TableCell>
      </TableRow>

      {/* Child rows */}
      {isExpanded && variants.map((build, idx) => {
        const rowKey = getRowKey(build);
        const compositeKey = makeKey(build.build_number, build.backend, build.architecture);
        const isInstalled = installedKeys.has(compositeKey);
        const isDownloading = downloadingKeys.has(compositeKey);
        const isFavorited = favoriteKeys.has(rowKey);
        const isLast = idx === variants.length - 1;

        return (
          <BuildRow
            key={rowKey}
            build={build}
            isInstalled={isInstalled}
            isDownloading={isDownloading}
            isFavorited={isFavorited}
            isLast={isLast}
            onToggleFavorite={() => onToggleFavorite(build)}
            onShowChangelog={() => onShowChangelog(build)}
            onDownload={() => onDownload(build)}
          />
        );
      })}
    </Fragment>
  );
}
