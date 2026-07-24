import { Button } from '@/components/ui/button';
import { RefreshCw, Clock } from 'lucide-react';

interface CatalogHeaderProps {
  onRefresh: (e: React.MouseEvent) => void;
  isRefreshing: boolean;
  canRefresh: boolean;
  secondsLeft: number;
  lastFetched: string | null;
  formatRelativeTime: (isoString: string) => string;
}

export function CatalogHeader({
  onRefresh,
  isRefreshing,
  canRefresh,
  secondsLeft,
  lastFetched,
  formatRelativeTime,
}: CatalogHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
        <p className="text-muted-foreground mt-1">
          Browse and download llama.cpp builds from GitHub.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {lastFetched && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Last updated: {formatRelativeTime(lastFetched)}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="gap-2"
          title={canRefresh ? "Refresh build list" : `Refresh available in ${secondsLeft}s`}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : (!canRefresh ? `${secondsLeft}s` : 'Update')}
        </Button>
      </div>
    </div>
  );
}
