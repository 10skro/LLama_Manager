import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useInstalledVersions } from '@/hooks/useInstalledVersions';
import { useStorageUsage } from '@/hooks/useStorageUsage';
import { useLatestBuildInfo } from '@/hooks/useLatestBuildInfo';
import { useVersionConfigLinks } from '@/hooks/useVersionConfigLinks';
import { useConfigs } from '@/hooks/useConfigs';

import { useToast } from '@/hooks/use-toast';
import { uninstallVersion, getCardCustomizations } from '@/services/version';
import { getVersionOverride } from '@/services/versionOverride';
import type { CardCustomization, VersionOverride } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { formatSize } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { LaunchConfigModal } from '@/components/LaunchConfig';
import { CustomCommandModal } from '@/components/CustomCommand';
import { VersionCard } from '@/components/Dashboard/VersionCard';
import {
  Package, Trash2,
  Loader2,
  HardDrive, Cpu, Plus, FileText,
  Terminal,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: versions, isLoading } = useInstalledVersions();
  const { storageUsage, isLoading: storageLoading } = useStorageUsage();
  const { latestInstalled, latestAvailable, updateAvailable } = useLatestBuildInfo();
  const settings = useAppStore((state) => state.settings);

  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLaunchConfigOpen, setIsLaunchConfigOpen] = useState(false);
  const [isCustomCommandOpen, setIsCustomCommandOpen] = useState(false);
  // Card customizations per version (versionId -> customization)
  const [cardCustomizations, setCardCustomizations] = useState<Record<number, CardCustomization>>({});
  // Version overrides per version (versionId -> override)
  const [versionOverrides, setVersionOverrides] = useState<Record<number, VersionOverride>>({});
  // Shared editing state: only one card's customize dropdown can be open at a time
  const [editingDropdownId, setEditingDropdownId] = useState<number | null>(null);
  const [tempTitle, setTempTitle] = useState('');
  const [tempColor, setTempColor] = useState('');
  const [tempTextColor, setTempTextColor] = useState('');

  // Lifted hooks: shared config links and configs across all version cards
  const { getLink, setLink, removeLink, loadAll } = useVersionConfigLinks();
  const { allEntries: configs, isLoading: configsLoading } = useConfigs();

  // Load config links for all installed versions
  useEffect(() => {
    if (versions && versions.length > 0) {
      loadAll(versions.map(v => v.id));
    }
  }, [versions, loadAll]);

  // Load overrides for all installed versions
  useEffect(() => {
    if (!versions || versions.length === 0) return;

    const loadOverrides = async () => {
      const record: Record<number, VersionOverride> = {};
      for (const version of versions) {
        try {
          const override = await getVersionOverride(version.id);
          if (override) {
            record[version.id] = override;
          }
        } catch (err) {
          console.error(`Failed to load override for version ${version.id}:`, err);
        }
      }
      setVersionOverrides(record);
    };
    loadOverrides();
  }, [versions]);

  // Load customizations from backend on mount
  useEffect(() => {
    const loadCustomizations = async () => {
      try {
        const customs = await getCardCustomizations();
        const record: Record<number, CardCustomization> = {};
        for (const c of customs) {
          record[c.version_id] = c;
        }
        setCardCustomizations(record);
      } catch (err) {
        console.error('Failed to load card customizations:', err);
      }
    };
    loadCustomizations();
  }, []);

  const handleDelete = async () => {
    if (deleteTarget === null) return;
    const versionToDelete = versions?.find(v => v.id === deleteTarget);
    setIsDeleting(true);
    try {
      await uninstallVersion(deleteTarget);
      await queryClient.invalidateQueries({ queryKey: ['installed-versions'] });
      setCardCustomizations(prev => {
        const next = { ...prev };
        delete next[deleteTarget];
        return next;
      });
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

  const handleCustomizationChange = (versionId: number, customization?: CardCustomization) => {
    setCardCustomizations(prev => {
      const next = { ...prev };
      if (customization) {
        next[versionId] = customization;
      } else {
        delete next[versionId];
      }
      return next;
    });
  };

  const handleOverrideChange = (versionId: number, override: VersionOverride | null) => {
    setVersionOverrides(prev => {
      const next = { ...prev };
      if (override) {
        next[versionId] = override;
      } else {
        delete next[versionId];
      }
      return next;
    });
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Config
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsLaunchConfigOpen(true)}>
              <FileText className="h-4 w-4" />
              Build Config
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsCustomCommandOpen(true)}>
              <Terminal className="h-4 w-4" />
              Create Custom Command
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-2xl font-semibold truncate">
                  {latestInstalled?.build_number ?? '\u2014'}
                </p>
                {updateAvailable && (
                  <Badge variant="outline" className="text-xs border-green/40 text-green shrink-0">
                    {latestAvailable?.build_number ?? 'update'}
                  </Badge>
                )}
              </div>
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
              {storageLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <p className="text-2xl font-semibold">
                  {storageUsage != null ? formatSize(storageUsage) : '\u2014'}
                </p>
              )}
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
            <VersionCard
              key={version.id}
              version={version}
              customization={cardCustomizations[version.id]}
              onCustomizationChange={handleCustomizationChange}
              onDeleteClick={setDeleteTarget}
              editingDropdownId={editingDropdownId}
              onEditingDropdownChange={setEditingDropdownId}
              tempTitle={tempTitle}
              onTempTitleChange={setTempTitle}
              tempColor={tempColor}
              onTempColorChange={setTempColor}
              tempTextColor={tempTextColor}
              onTempTextColorChange={setTempTextColor}
              configLink={getLink(version.id)}
              configs={configs}
              configsLoading={configsLoading}
              onSetLink={setLink}
              onRemoveLink={removeLink}
              override={versionOverrides[version.id] ?? null}
              onOverrideChange={handleOverrideChange}
              modelFolder={settings?.model_folder}
              mmprojFolder={settings?.mmproj_folder}
            />
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

      {/* Launch Config Modal */}
      <LaunchConfigModal
        open={isLaunchConfigOpen}
        onOpenChange={setIsLaunchConfigOpen}
      />

      {/* Custom Command Modal */}
      <CustomCommandModal
        open={isCustomCommandOpen}
        onOpenChange={setIsCustomCommandOpen}
      />
    </div>
  );
}
