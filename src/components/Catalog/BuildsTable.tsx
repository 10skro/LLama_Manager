import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import { VersionGroup } from './VersionGroup';
import type { Build } from '@/types';

interface BuildsTableProps {
  filteredBuilds: Build[];
  groupedBuilds: Map<string, Build[]>;
  isLoading: boolean;
  queryIsError: boolean;
  builds: Build[];
  searchingVersion: boolean;
  searchState: { tag: string | null; builds: Build[] | null };
  expandedVersions: Set<string>;
  onToggleVersion: (buildNumber: string) => void;
  installedKeys: Set<string>;
  downloadingKeys: Set<string>;
  favoriteKeys: Set<string>;
  onToggleFavorite: (build: Build) => void;
  onShowChangelog: (build: Build) => void;
  onDownload: (build: Build) => void;
}

export function BuildsTable({
  filteredBuilds,
  groupedBuilds,
  isLoading,
  queryIsError,
  builds,
  searchingVersion,
  searchState,
  expandedVersions,
  onToggleVersion,
  installedKeys,
  downloadingKeys,
  favoriteKeys,
  onToggleFavorite,
  onShowChangelog,
  onDownload,
}: BuildsTableProps) {
  return (
    <Card className="border-border/50 bg-card/50 flex-1">
      <CardContent className="p-0">
        {isLoading ? (
          /* Skeleton Loading */
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : searchState.tag && searchingVersion ? (
          /* Search Loading Empty State */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground font-medium">
              Searching for "{searchState.tag}"...
            </p>
            <p className="text-muted-foreground/60 text-sm mt-1">
              This may take a moment for older builds.
            </p>
          </div>
        ) : filteredBuilds.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            {queryIsError ? (
              <>
                <AlertCircle className="h-12 w-12 text-red-400/50 mb-4" />
                <p className="text-red-300 font-medium">Failed to load builds</p>
                <p className="text-muted-foreground/60 text-sm mt-1">
                  See error above for details. You can retry by clicking Update.
                </p>
              </>
            ) : builds?.length === 0 ? (
              <>
                <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground font-medium">No builds found</p>
                <p className="text-muted-foreground/60 text-sm mt-1">
                  Try refreshing or check your connection.
                </p>
              </>
            ) : (
              <>
                <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground font-medium">No builds match your filters</p>
                <p className="text-muted-foreground/60 text-sm mt-1">Try adjusting your filters.</p>
              </>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="text-center">Build</TableHead>
                <TableHead className="text-center">Arch</TableHead>
                <TableHead className="text-center">Backend</TableHead>
                <TableHead className="text-center">Date</TableHead>
                <TableHead className="text-center">Size</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(groupedBuilds.entries()).map(([buildNumber, variants]) => (
                <VersionGroup
                  key={buildNumber}
                  buildNumber={buildNumber}
                  variants={variants}
                  isExpanded={expandedVersions.has(buildNumber)}
                  onToggle={() => onToggleVersion(buildNumber)}
                  installedKeys={installedKeys}
                  downloadingKeys={downloadingKeys}
                  favoriteKeys={favoriteKeys}
                  onToggleFavorite={onToggleFavorite}
                  onShowChangelog={onShowChangelog}
                  onDownload={onDownload}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
