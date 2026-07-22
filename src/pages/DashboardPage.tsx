import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useInstalledVersions } from '@/hooks/useInstalledVersions';
import { useCheckNewBuilds } from '@/hooks/useBuilds';
import { useToast } from '@/hooks/use-toast';
import { useRefreshCooldown } from '@/hooks/useRefreshCooldown';
import { uninstallVersion, openFolder } from '@/services/version';
import { getBackendColor } from '@/utils/backendColors';
import { formatDate } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Package, FolderOpen, Trash2, Settings, RefreshCw,
  CheckCircle2, AlertCircle, Loader2, Bell, Download,
  HardDrive, Calendar, Cpu,
} from 'lucide-react';

function truncatePath(path: string, maxLen: number = 40): string {
  if (path.length <= maxLen) return path;
  const parts = path.split('\\');
  if (parts.length <= 3) return path.substring(0, maxLen) + '...';
  return `${parts[0]}\\...\\${parts[parts.length - 2]}\\${parts[parts.length - 1]}`;
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: versions, isLoading } = useInstalledVersions();
  const { data: newBuildsData, refetch: checkUpdates } = useCheckNewBuilds();
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { canRefresh: canCheck, isRefreshing: isCheckingCooldown, secondsLeft, refresh: checkRefresh, forceRefresh: forceCheckRefresh } = useRefreshCooldown(
    async () => {
      return await checkUpdates();
    },
    { cooldownMs: 30_000 }
  );

  const handleOpenFolder = async (path: string) => {
    try {
      await openFolder(path);
    } catch (err) {
      console.error('Failed to open folder:', err);
      toast({
        title: 'Error',
        description: 'Failed to open folder.',
      });
    }
  };

  const handleDelete = async () => {
    if (deleteTarget === null) return;
    const versionToDelete = versions?.find(v => v.id === deleteTarget);
    setIsDeleting(true);
    try {
      await uninstallVersion(deleteTarget);
      await queryClient.invalidateQueries({ queryKey: ['installed-versions'] });
      toast({
        title: 'Version deleted',
        description: `${versionToDelete?.build_number ?? 'Version'} has been removed.`,
      });
    } catch (err) {
      console.error('Failed to uninstall:', err);
      toast({
        title: 'Delete failed',
        description: 'Could not remove the version.',
      });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleCheckUpdatesClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey) {
      (async () => {
        try {
          const result = await forceCheckRefresh();
          const newCount = result?.data?.newBuilds?.length ?? 0;
          toast({
            title: 'Force refresh',
            description: newCount
              ? `${newCount} new build(s) available. (cooldown bypassed)`
              : 'No new builds available. (cooldown bypassed)',
          });
        } catch (err) {
          console.error('Failed to check updates:', err);
          toast({
            title: 'Check failed',
            description: 'Could not check for updates.',
          });
        }
      })();
    } else {
      if (!canCheck) {
        toast({ title: 'Cooldown active', description: `Please wait ${secondsLeft}s before checking, or hold Shift to force.` });
        return;
      }
      (async () => {
        try {
          const result = await checkRefresh();
          const newCount = result?.data?.newBuilds?.length ?? 0;
          toast({
            title: 'Update check complete',
            description: newCount
              ? `${newCount} new build(s) available.`
              : 'No new builds available.',
          });
        } catch (err) {
          console.error('Failed to check updates:', err);
          toast({
            title: 'Check failed',
            description: 'Could not check for updates.',
          });
        }
      })();
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of your installed llama.cpp builds.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCheckUpdatesClick}
          disabled={isCheckingCooldown}
          className="gap-2"
          title={canCheck ? "Check for updates (hold Shift to force)" : `Check available in ${secondsLeft}s (hold Shift to force)`}
        >
          <RefreshCw className={`h-4 w-4 ${isCheckingCooldown ? 'animate-spin' : ''}`} />
          {isCheckingCooldown ? 'Checking...' : (!canCheck ? `${secondsLeft}s` : 'Check Updates')}
        </Button>
      </div>

      {/* New Build Notification */}
      {newBuildsData?.newBuilds && newBuildsData.newBuilds.length > 0 && (
        <div className="flex items-center gap-4 rounded-lg border border-blue/30 bg-blue/10 p-4">
          <Bell className="h-5 w-5 text-blue shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue/80">
              {newBuildsData.newBuilds.length} new build{newBuildsData.newBuilds.length > 1 ? 's' : ''} available
            </p>
            <p className="text-xs text-blue/50 mt-0.5">
              Visit the Catalog to download the latest versions.
            </p>
          </div>
          <Download className="h-5 w-5 text-blue" />
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue/20">
              <Package className="h-5 w-5 text-blue" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{versions?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Installed</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green/20">
              <Cpu className="h-5 w-5 text-green" />
            </div>
            <div>
              <p className="text-2xl font-semibold">
                {versions?.length ? versions[0].build_number : '\u2014'}
              </p>
              <p className="text-xs text-muted-foreground">Latest Build</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-mauve/20">
              <HardDrive className="h-5 w-5 text-mauve" />
            </div>
            <div>
              <p className="text-2xl font-semibold">\u2014</p>
              <p className="text-xs text-muted-foreground">Storage Used</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Version Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : versions && versions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {versions.map((version) => (
            <Card
              key={version.id}
              className="border-border/50 bg-card/50 hover:border-border/80 transition-colors group"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                      <Package className="h-5 w-5 text-foreground" />
                    </div>
                    <div>
                      <p className="font-mono font-semibold text-lg">
                        {version.build_number}
                      </p>
                      <Badge
                        variant="outline"
                        className={`border ${getBackendColor(version.backend)}`}
                      >
                        {version.backend}
                      </Badge>
                    </div>
                  </div>
                  {version.status === 'installed' ? (
                    <CheckCircle2 className="h-5 w-5 text-green" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span>Installed {formatDate(version.installed_at)}</span>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 text-muted-foreground cursor-help">
                          <FolderOpen className="h-4 w-4 shrink-0" />
                          <span className="truncate">{truncatePath(version.install_path)}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{version.install_path}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <Separator className="border-border/50" />

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => handleOpenFolder(version.install_path)}
                  >
                    <FolderOpen className="h-4 w-4" />
                    Open
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-red hover:text-red/80 hover:bg-red/10 border-red/20"
                    onClick={() => setDeleteTarget(version.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled title="Coming soon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Empty State */
        <Card className="border-border/50 bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary mb-6">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No versions installed</h3>
            <p className="text-muted-foreground mt-2 max-w-sm">
              Get started by browsing available builds in the Catalog and downloading your first llama.cpp version.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red" />
              Delete Version
            </DialogTitle>
            <DialogDescription>
              This will permanently remove the installed version and all associated files. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
