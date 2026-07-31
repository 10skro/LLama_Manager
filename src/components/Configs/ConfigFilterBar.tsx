import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ConfigFilter } from '@/hooks/useConfigs';

interface ConfigFilterBarProps {
  search: string;
  setSearch: (v: string) => void;
  filter: ConfigFilter;
  setFilter: (f: ConfigFilter) => void;
  totalCount: number;
}

export function ConfigFilterBar({
  search,
  setSearch,
  filter,
  setFilter,
  totalCount,
}: ConfigFilterBarProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or description..."
          className="pl-9 pr-9 bg-card border-border/50"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Type Filter */}
      <div className="flex items-center gap-1 bg-card border border-border/50 rounded-lg p-1">
        {(['all', 'custom'] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
            className={`text-xs h-7 px-3 ${filter === f ? 'border-primary/50 font-semibold' : 'border-border/40 text-muted-foreground'}`}
          >
            {f === 'all' ? 'All' : 'Custom'}
          </Button>
        ))}
      </div>

      <div className="text-sm text-muted-foreground">
        {totalCount} config{totalCount !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
