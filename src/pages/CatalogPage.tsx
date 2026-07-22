import { useState, useMemo, useEffect, useRef } from 'react';
import { useBuilds } from '@/hooks/useBuilds';
import { useInstalledVersions } from '@/hooks/useInstalledVersions';
import { useFavorites, useToggleFavorite } from '@/hooks/useFavorites';
import { useAppStore } from '@/store/useAppStore';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { installVersion } from '@/services/download';
import { fetchReleaseByTag, searchBuilds } from '@/services/github';
import { getBackendColor } from '@/utils/backendColors';
import { formatDate } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ChangelogModal } from '@/components/ChangelogModal';
import {
  RefreshCw, Search, Download, X,
  CheckCircle2, AlertCircle, Loader2, Star, Info,
} from 'lucide-react';
import type { Build } from '@/types';

function getBuildKey(build: { build_number: string; backend: string; download_url: string }): string {
  // Use URL as unique identifier since same build_number+backend can appear in search results
  // Fallback to build_number+backend if download_url is missing/empty
  return build.download_url || `${build.build_number}_${build.backend}`;
}

function getBuildIdentifier(build_number: string, backend: string): string {
  // Used for matching against installed versions, download tracking, and legacy key generation
  return `${build_number}_${backend}`;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function CatalogPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { filters, setFilters } = useAppStore();
  const { data: builds = [], isLoading, refetch, isError: queryIsError, error: queryError } = useBuilds();
  const { data: installed } = useInstalledVersions();
  const [downloading, setDownloading] = useState<Map<string, number>>(new Map()); // key -> downloadId
  const [error, setError] = useState<string | null>(null);

  // Favorites
  const { data: favorites = [] } = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const favoriteKeys = useMemo(() => {
    const keys = new Set<string>();
    favorites?.forEach(f => {
      keys.add(getBuildIdentifier(f.build_number, f.backend));
    });
    return keys;
  }, [favorites]);

  // Changelog modal state
  const [changelogModal, setChangelogModal] = useState<{ open: boolean; tag: string; build: string }>({
    open: false, tag: '', build: '',
  });

  // Unified version search state
  const [searchingVersion, setSearchingVersion] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchState, setSearchState] = useState<{ tag: string | null; builds: Build[] | null }>({ tag: null, builds: null });
  const abortControllerRef = useRef<AbortController | null>(null);

  // Surface API errors to the user
  useEffect(() => {
    if (queryError) {
      const msg = queryError.message || '';
      if (msg.includes('429') || msg.includes('rate limit')) {
        setError(
          'GitHub API rate limit exceeded. Add a GitHub token in Settings to increase your limit.'
        );
      } else if (msg.includes('network') || msg.includes('connect') || msg.includes('timeout')) {
        setError(
          'Network error: Could not reach GitHub API. Check your connection or try again later.'
        );
      } else {
        setError(msg || 'Failed to fetch builds from GitHub API.');
      }
    }
  }, [queryError]);

  // Installed build keys for status check
  const installedKeys = useMemo(() => {
    const keys = new Set<string>();
    installed?.forEach(v => {
      // Build a download_url-like key from installed version to match against getBuildKey
      // Installed versions are matched by build_number+backend
      keys.add(getBuildIdentifier(v.build_number, v.backend));
    });
    return keys;
  }, [installed]);

  // Filtered and sorted builds
  const filteredBuilds = useMemo(() => {
    // Use searchState.builds when a specific version is active, otherwise use default builds
    let result = searchState.tag ? (searchState.builds || []) : (builds || []);

    // Search filter (only apply text filter when no active version search)
    if (!searchState.tag && filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(b =>
        b.build_number.toLowerCase().includes(search) ||
        b.backend.toLowerCase().includes(search) ||
        b.architecture.toLowerCase().includes(search) ||
        b.platform.toLowerCase().includes(search) ||
        b.tag_name.toLowerCase().includes(search)
      );
    }

    // Backend filter
    if (filters.backend.length > 0) {
      result = result.filter(b =>
        filters.backend.some(fb => b.backend.toLowerCase().includes(fb.toLowerCase()))
      );
    }

    // Architecture filter
    if (filters.architecture) {
      result = result.filter(b => b.architecture === filters.architecture);
    }

    // Favorites filter
    if (filters.favoritesOnly) {
      result = result.filter(b => favoriteKeys.has(getBuildIdentifier(b.build_number, b.backend)));
    }

    // Sort (copy before sorting to avoid mutating source arrays)
    result = [...result].sort((a, b) => {
      if (filters.sortBy === 'date') {
        return filters.sortOrder === 'desc'
          ? new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
          : new Date(a.published_at).getTime() - new Date(b.published_at).getTime();
      }
      const numA = parseInt(a.build_number.replace('b', ''));
      const numB = parseInt(b.build_number.replace('b', ''));
      return filters.sortOrder === 'desc' ? numB - numA : numA - numB;
    });

    return result;
  }, [builds, filters, searchState.tag, searchState.builds, favoriteKeys]);

  // Count unique versions for display
  const versionCounts = useMemo(() => {
    const shown = new Set(filteredBuilds.map(b => b.build_number)).size;
    const source = searchState.tag ? searchState.builds : builds;
    const total = new Set((source || []).map(b => b.build_number)).size;
    return { shown, total };
  }, [filteredBuilds, builds, searchState.tag, searchState.builds]);

  const handleDownload = async (build: Build) => {
    const legacyKey = getBuildIdentifier(build.build_number, build.backend);
    setError(null);
    try {
      const downloadId = await installVersion(build);
      setDownloading(prev => new Map(prev).set(legacyKey, downloadId));
      // Invalidate installed_versions cache so UI reflects the new installation
      queryClient.invalidateQueries({ queryKey: ['installed-versions'] });
      toast({
        title: 'Download started',
        description: `Downloading ${build.build_number} (${build.backend})...`,
      });
    } catch (err: any) {
      setError(err.message || 'Download failed');
      toast({
        title: 'Download failed',
        description: err.message || 'Could not start download.',
      });
    }
  };

  const handleRefresh = async () => {
    setError(null);
    try {
      await refetch();
      toast({
        title: 'Catalog updated',
        description: 'Build list has been updated.',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to update');
      toast({
        title: 'Update failed',
        description: err.message || 'Could not update the build list.',
      });
    }
  };

  const handleVersionSearch = async () => {
    if (searchingVersion) return;
    const tag = filters.search.trim();
    if (!tag) return;

    // Validate input: only allow alphanumeric characters, hyphens, and underscores
    if (!/^[a-zA-Z0-9_-]+$/.test(tag)) {
      setSearchError('Invalid version format. Use alphanumeric characters only (e.g., b9976, 9976).');
      setSearchingVersion(false);
      return;
    }

    // Abort any pending search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setSearchError(null);
    setSearchingVersion(true);
    setSearchState({ tag, builds: null });
    try {
      // Strategy 1: Try exact tag match first
      try {
        const exactResults = await fetchReleaseByTag(tag);
        if (!controller.signal.aborted && exactResults.length > 0) {
          setSearchState({ tag, builds: exactResults });
          return;
        }
      } catch (err: any) {
        if (controller.signal.aborted) return;
        // Exact tag not found, fall through
      }

      // Strategy 2: If tag starts with 'b', try without it
      if (tag.startsWith('b')) {
        try {
          const normalizedTag = tag.slice(1);
          const results = await fetchReleaseByTag(normalizedTag);
          if (!controller.signal.aborted && results.length > 0) {
            setSearchState({ tag, builds: results });
            return;
          }
        } catch {
          if (controller.signal.aborted) return;
          // Fall through
        }
      }

      // Strategy 3: Use search_builds API for partial match
      const searchResults = await searchBuilds(tag);
      if (!controller.signal.aborted) {
        if (searchResults.length > 0) {
          setSearchState({ tag, builds: searchResults });
        } else {
          setSearchError(`No builds found matching "${tag}".`);
          setSearchState({ tag, builds: [] });
        }
      }
    } catch (err: any) {
      if (controller.signal.aborted) return;
      setSearchError(err.message || `Failed to search for "${tag}".`);
      setSearchState({ tag, builds: [] });
    } finally {
      if (!controller.signal.aborted) {
        setSearchingVersion(false);
      }
      abortControllerRef.current = null;
    }
  };

  const handleClearSearch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setSearchState({ tag: null, builds: null });
    setSearchError(null);
    setSearchingVersion(false);
    setFilters({ search: '' });
    // Query invalidation is handled by the reactive useEffect below,
    // which triggers on setFilters({ search: '' }). Removing duplicate call here.
  };

  // Reactive clearing: when search input becomes empty and an active tag exists, reset
  useEffect(() => {
    if (searchState.tag && filters.search === '') {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setSearchState({ tag: null, builds: null });
      setSearchError(null);
      setSearchingVersion(false);
      queryClient.invalidateQueries({ queryKey: ['builds'] });
    }
  }, [filters.search, searchState.tag, queryClient]);

  // Available backend types from builds
  const availableBackends = useMemo(() => {
    const backends = new Set<string>();
    const source = searchState.tag ? (searchState.builds || []) : (builds || []);
    source.forEach(b => backends.add(b.backend));
    return Array.from(backends);
  }, [builds, searchState.tag, searchState.builds]);

  const toggleBackendFilter = (backend: string) => {
    const current = filters.backend;
    if (current.includes(backend)) {
      setFilters({ backend: current.filter(b => b !== backend) });
    } else {
      setFilters({ backend: [...current, backend] });
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
          <p className="text-muted-foreground mt-1">
            Browse and download llama.cpp builds from GitHub.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Update
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Version Search Banner */}
      {searchState.tag && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
          <Search className="h-5 w-5 text-blue-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-blue-300">
              Showing builds for <span className="font-mono font-medium">{searchState.tag}</span>
            </p>
            {searchError && (
              <p className="text-xs text-red-300 mt-1">{searchError}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleClearSearch}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Filter Bar */}
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
                  if (e.key === 'Enter' && !searchState.tag) handleVersionSearch();
                }}
                disabled={searchingVersion}
                className="pl-10 bg-background/50 border-border/50 pr-10"
              />
              {searchingVersion ? (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              ) : searchState.tag ? (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleVersionSearch()}
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

            {/* Backend Filters */}
            <div className="flex flex-wrap gap-2 max-w-[300px] overflow-y-auto max-h-[40px] scrollbar-thin">
              {availableBackends.map(backend => (
                <Badge
                  key={backend}
                  variant="outline"
                  className={`cursor-pointer transition-colors ${
                    filters.backend.includes(backend)
                      ? `${getBackendColor(backend)} bg-primary/20`
                      : `${getBackendColor(backend)} hover:bg-secondary`
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

      {/* Builds Table */}
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
              <p className="text-muted-foreground font-medium">Searching for "{searchState.tag}"...</p>
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
                  <p className="text-muted-foreground/60 text-sm mt-1">
                    Try adjusting your filters.
                  </p>
                </>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Build</TableHead>
                    <TableHead>Backend</TableHead>
                    <TableHead>Arch</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBuilds.map((build) => {
                  const rowKey = getBuildKey(build);
                  const legacyKey = getBuildIdentifier(build.build_number, build.backend);
                  const isInstalled = installedKeys.has(legacyKey);
                  const isDownloading = downloading.has(legacyKey);
                  const isFavorited = favoriteKeys.has(legacyKey);

                  return (
                    <TableRow key={rowKey} className="border-border/30 hover:bg-secondary/30">
                      <TableCell>
                        <button
                          aria-pressed={isFavorited}
                          aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                          onClick={() => toggleFavorite.mutate({
                            buildNumber: build.build_number,
                            backend: build.backend,
                          })}
                          className="hover:opacity-80 transition-opacity"
                          title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Star
                            className={`h-4 w-4 ${isFavorited ? 'fill-[hsl(var(--yellow))] text-[hsl(var(--yellow))]' : 'fill-none text-muted-foreground'}`}
                          />
                        </button>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm font-medium">
                          {build.build_number}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`border ${getBackendColor(build.backend)}`}
                        >
                          {build.backend}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {build.architecture}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(build.published_at)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {formatSize(build.file_size)}
                      </TableCell>
                      <TableCell>
                        {isInstalled ? (
                          <div className="flex items-center gap-1.5 text-emerald-400">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-xs">Installed</span>
                          </div>
                        ) : isDownloading ? (
                          <div className="flex items-center gap-1.5 text-blue-400">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-xs">Downloading</span>
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setChangelogModal({ open: true, tag: build.tag_name, build: build.build_number })}
                            className="h-8 w-8 p-0"
                            title="View changelog"
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                          {isInstalled ? (
                            <Button variant="secondary" size="sm" disabled>
                              Installed
                            </Button>
                          ) : isDownloading ? (
                            <Button variant="outline" size="sm" disabled>
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              Downloading
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleDownload(build)}
                              className="gap-2"
                            >
                              <Download className="h-4 w-4" />
                              Download
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Results count */}
      {filteredBuilds.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {searchState.tag
            ? `${versionCounts.shown} version(s) for "${searchState.tag}"`
            : `${versionCounts.shown} version(s) shown of ${versionCounts.total} total`
          }
        </p>
      )}

      {/* Changelog Modal */}
      <ChangelogModal
        open={changelogModal.open}
        onOpenChange={(open) => setChangelogModal(prev => ({ ...prev, open }))}
        tagName={changelogModal.tag}
        buildNumber={changelogModal.build}
      />
    </div>
  );
}
