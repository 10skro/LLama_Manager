import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Search, X, Loader2, Star, HardDrive } from 'lucide-react';
import { getBackendColor } from '@/utils/backendColors';
import type { Build, BuildFilters } from '@/types';

interface FilterBarProps {
  filters: BuildFilters;
  setFilters: (filters: Partial<BuildFilters>) => void;
  availableBackends: string[];
  toggleBackendFilter: (backend: string) => void;
  searchingVersion: boolean;
  searchState: { tag: string | null; builds: Build[] | null };
  onVersionSearch: () => void;
  onClearSearch: () => void;
}

export function FilterBar({
  filters,
  setFilters,
  availableBackends,
  toggleBackendFilter,
  searchingVersion,
  searchState,
  onVersionSearch,
  onClearSearch,
}: FilterBarProps) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search builds (type to filter, press Enter for version search)..."
              value={filters.search}
              onChange={e => setFilters({ search: e.target.value })}
              onKeyDown={e => {
                if (e.key === 'Enter' && !searchState.tag) onVersionSearch();
              }}
              disabled={searchingVersion}
              className="pl-10 bg-background/50 border-border/50 pr-10"
            />
            {searchingVersion ? (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            ) : searchState.tag ? (
              <button
                type="button"
                onClick={onClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onVersionSearch()}
                disabled={!filters.search.trim()}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
                title="Search for specific version on GitHub"
              >
                <Search className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Favorites Filter Toggle */}
          <Button
            variant={filters.favoritesOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilters({ favoritesOnly: !filters.favoritesOnly })}
            className="gap-2"
          >
            <Star className={`h-4 w-4 ${filters.favoritesOnly ? 'fill-current' : ''}`} />
            {filters.favoritesOnly ? 'Favorites Only' : 'Favorites'}
          </Button>

          {/* Installed Filter Toggle */}
          <Button
            variant={filters.installedOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilters({ installedOnly: !filters.installedOnly })}
            className="gap-2"
          >
            <HardDrive className={`h-4 w-4 ${filters.installedOnly ? 'fill-current' : ''}`} />
            {filters.installedOnly ? 'Installed Only' : 'Installed'}
          </Button>

          {/* Backend Filters */}
          <div className="flex flex-wrap gap-2 max-w-[300px] overflow-y-auto max-h-[40px] scrollbar-thin">
            {availableBackends.map(backend => (
              <Badge
                key={backend}
                variant="outline"
                className={`cursor-pointer transition-all ${
                  filters.backend.includes(backend)
                    ? `${getBackendColor(backend)} bg-primary/20 border-primary/60 font-semibold`
                    : `${getBackendColor(backend)} opacity-50 hover:opacity-80`
                }`}
                onClick={() => toggleBackendFilter(backend)}
              >
                {backend}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
