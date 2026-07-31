import { useState, useEffect, useCallback, useMemo } from 'react';
import { emit } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';

import type { InstalledVersion } from '@/types';
import { useInstalledVersions } from '@/hooks/useInstalledVersions';
import { useStorageUsage } from '@/hooks/Dashboard/useStorageUsage';
import { useLatestBuildInfo } from '@/hooks/Catalog/useLatestBuildInfo';
import { useVersionConfigLinks } from '@/hooks/Dashboard/useVersionConfigLinks';
import { useConfigs } from '@/hooks/Configs/useConfigs';
import { useToast, type ToastOptions } from '@/hooks/use-toast';
import {
  uninstallVersion,
  getCardCustomizations,
  duplicateVersion,
  bulkSetDisplayOrder,
  saveCardCustomization,
} from '@/services/version';
import { getVersionOverride, saveVersionOverride } from '@/services/versionOverride';
import { saveVersionConfigLink } from '@/services/versionConfig';
import type { CardCustomization, CardClipboardData } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { formatSize } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, Trash2, Loader2, HardDrive, Cpu } from 'lucide-react';
import { ToastAction } from '@/components/ui/toast';

import {
  ReorderableGrid,
  StatCard,
  DashboardProvider,
  useDashboardContext,
} from '@/components/Dashboard';
import type { VersionCardActions } from '@/components/Dashboard/ReorderableGrid';

/* ─── Helpers ─── */

/** Load card customizations from backend into a versionId→customization record. */
async function loadCardCustomizationsRecord(): Promise<Record<number, CardCustomization>> {
  const customs = await getCardCustomizations();
  const record: Record<number, CardCustomization> = {};
  for (const c of customs) {
    record[c.version_id] = c;
  }
  return record;
}

/* ─── Main Component ─── */

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: versions, isLoading } = useInstalledVersions();
  const { storageUsage, isLoading: storageLoading } = useStorageUsage();
  const { latestInstalled } = useLatestBuildInfo();
  const settings = useAppStore((state) => state.settings);

  // Dialogs
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Lifted hooks: shared config links and configs across all version cards
  const { getLink, setLink, removeLink, loadAll } = useVersionConfigLinks();
  const { allEntries: configs, isLoading: configsLoading } = useConfigs();

  // Load config links for all installed versions
  useEffect(() => {
    if (versions && versions.length > 0) {
      loadAll(versions.map((v) => v.id));
    }
  }, [versions, loadAll]);

  // --- Action handlers ---

  const handleDelete = async () => {
    if (deleteTarget === null) return;
    const versionToDelete = versions?.find((v) => v.id === deleteTarget);
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

  const handleDuplicate = async (versionId: number, withSettings: boolean) => {
    try {
      await duplicateVersion(versionId, withSettings);
      await queryClient.invalidateQueries({ queryKey: ['installed-versions'] });
      toast({
        title: withSettings ? 'Cloned with settings' : 'Cloned',
        description: withSettings
          ? 'A copy with your current settings has been created.'
          : 'A clean copy has been created.',
      });
    } catch (err) {
      console.error('Failed to duplicate version:', err);
      toast({
        variant: 'destructive',
        title: 'Clone failed',
        description: 'Could not duplicate this version.',
      });
    }
  };

  // --- Reorder handlers ---

  const handleDragEnd = async (newVersions: InstalledVersion[]) => {
    if (!versions || newVersions.length !== versions.length) return;

    const orders = newVersions.map((v, i) => ({ versionId: v.id, displayOrder: i }));

    try {
      await bulkSetDisplayOrder(orders);
      await queryClient.invalidateQueries({ queryKey: ['installed-versions'] });
      toast({
        title: 'Order updated',
        description: 'Card order has been saved.',
      });
    } catch (err) {
      console.error('Failed to save card order:', err);
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: 'Could not save the new card order.',
      });
    }
  };

  return (
    <DashboardProvider
      getLink={getLink}
      setLink={setLink}
      removeLink={removeLink}
      configs={configs}
      configsLoading={configsLoading}
      modelFolder={settings?.model_folder}
      mmprojFolder={settings?.mmproj_folder}
    >
      <DashboardContent
        versions={versions}
        isLoading={isLoading}
        storageUsage={storageUsage ?? null}
        storageLoading={storageLoading}
        latestInstalled={latestInstalled}
        deleteTarget={deleteTarget}
        setDeleteTarget={setDeleteTarget}
        isDeleting={isDeleting}
        onDragEnd={handleDragEnd}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        toast={toast}
      />
    </DashboardProvider>
  );
}

/* ─── Inner content (inside DashboardProvider, can use context) ─── */

function DashboardContent({
  versions,
  isLoading,
  storageUsage,
  storageLoading,
  latestInstalled,
  deleteTarget,
  setDeleteTarget,
  isDeleting,
  onDragEnd,
  onDelete,
  onDuplicate,
  toast,
}: {
  versions: import('@/types').InstalledVersion[] | undefined;
  isLoading: boolean;
  storageUsage: number | null;
  storageLoading: boolean;
  latestInstalled: { build_number: string } | null;
  deleteTarget: number | null;
  setDeleteTarget: (id: number | null) => void;
  isDeleting: boolean;
  onDragEnd: (newVersions: InstalledVersion[]) => void;
  onDelete: () => void;
  onDuplicate: (versionId: number, withSettings: boolean) => void;
  toast: (options: ToastOptions) => void;
}) {
  const {
    cardCustomizations,
    setCustomization,
    getLink,
    setLink,
    versionOverrides,
    setOverride,
    clipboardData,
    setClipboardData,
  } = useDashboardContext();

  // Paste dialog state
  const [pasteTarget, setPasteTarget] = useState<number | null>(null);
  const [isPasting, setIsPasting] = useState(false);

  // Load customizations from backend on mount
  useEffect(() => {
    let cancelled = false;
    loadCardCustomizationsRecord()
      .then((record) => {
        if (!cancelled) {
          Object.values(record).forEach((c) => setCustomization(c.version_id, c));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [setCustomization]);

  // Load overrides for all installed versions
  useEffect(() => {
    if (!versions || versions.length === 0) return;
    let cancelled = false;
    Promise.all(
      versions.map(async (version) => {
        try {
          const override = await getVersionOverride(version.id);
          if (!cancelled && override) {
            setOverride(version.id, override);
          }
        } catch (err) {
          console.error(`Failed to load override for version ${version.id}:`, err);
        }
      })
    ).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [versions, setOverride]);

  // --- Copy handler (needs context data) ---
  const handleCopy = useCallback(
    (versionId: number) => {
      const custom = cardCustomizations[versionId];
      const link = getLink(versionId);
      const override = versionOverrides[versionId];

      const data: CardClipboardData = { sourceVersionId: versionId };

      if (custom && (custom.title || custom.header_color || custom.text_color)) {
        data.customization = {
          title: custom.title,
          header_color: custom.header_color,
          text_color: custom.text_color,
        };
      }
      if (link) {
        data.configLink = { config_type: link.config_type, config_id: link.config_id };
      }
      if (override) {
        data.override = { model_path: override.model_path, mmproj_path: override.mmproj_path };
      }

      setClipboardData(data);
      toast({
        title: 'Settings copied',
        description: 'Card settings are ready to paste on another card.',
        duration: 0,
        action: (
          <ToastAction altText="Cancel copy" onClick={() => setClipboardData(null)}>
            Cancel
          </ToastAction>
        ),
      });
    },
    [cardCustomizations, getLink, versionOverrides, setClipboardData, toast]
  );

  // --- Paste handler (needs context data) ---
  const handlePasteConfirm = useCallback(async () => {
    if (!clipboardData || pasteTarget === null) return;
    const targetId = pasteTarget;
    setIsPasting(true);
    try {
      if (clipboardData.customization) {
        const { title, header_color, text_color } = clipboardData.customization;
        if (title || header_color || text_color) {
          await saveCardCustomization(targetId, title, header_color, text_color);
          setCustomization(targetId, {
            version_id: targetId,
            title,
            header_color,
            text_color,
          });
        }
      }

      if (clipboardData.configLink) {
        await saveVersionConfigLink(
          targetId,
          clipboardData.configLink.config_type,
          clipboardData.configLink.config_id
        );
        setLink(targetId, clipboardData.configLink.config_type, clipboardData.configLink.config_id);
      }

      if (clipboardData.override) {
        const { model_path, mmproj_path } = clipboardData.override;
        if (model_path || mmproj_path) {
          await saveVersionOverride(targetId, model_path, mmproj_path);
          setOverride(targetId, {
            version_id: targetId,
            model_path,
            mmproj_path,
          });
        }
      }

      emit('card-customizations-update', null).catch(() => {});
      setClipboardData(null);
      setPasteTarget(null);
      toast({
        title: 'Settings pasted',
        description: 'Card settings have been applied successfully.',
      });
    } catch (err) {
      console.error('Failed to paste settings:', err);
      toast({
        variant: 'destructive',
        title: 'Paste failed',
        description: 'Could not apply settings to this card.',
      });
    } finally {
      setIsPasting(false);
    }
  }, [
    clipboardData,
    pasteTarget,
    setCustomization,
    setLink,
    setOverride,
    setClipboardData,
    setPasteTarget,
    toast,
  ]);

  // --- Duplicate handler: reload customizations when cloning with settings ---
  const handleDuplicateWithContext = useCallback(
    async (versionId: number, withSettings: boolean) => {
      await onDuplicate(versionId, withSettings);
      if (withSettings) {
        const record = await loadCardCustomizationsRecord();
        Object.values(record).forEach((c) => setCustomization(c.version_id, c));
      }
    },
    [onDuplicate, setCustomization]
  );

  // --- Unified actions object for VersionCard ---
  const actions: VersionCardActions = useMemo(
    () => ({
      onDeleteClick: (versionId: number) => setDeleteTarget(versionId),
      onDuplicateClick: handleDuplicateWithContext,
      onCopyClick: handleCopy,
      onPasteRequest: setPasteTarget,
    }),
    [handleDuplicateWithContext, handleCopy, setDeleteTarget, setPasteTarget]
  );

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your installed llama.cpp builds.</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<Package />}
          iconBg="bg-blue/20"
          iconText="text-blue"
          value={versions?.length || 0}
          label="Installed"
        />
        <StatCard
          icon={<Cpu />}
          iconBg="bg-green/20"
          iconText="text-green"
          value={latestInstalled?.build_number ?? '\u2014'}
          label="Latest Build"
        />
        <StatCard
          icon={<HardDrive />}
          iconBg="bg-mauve/20"
          iconText="text-mauve"
          value={
            storageLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : storageUsage != null ? (
              formatSize(storageUsage)
            ) : (
              '\u2014'
            )
          }
          label="Storage Used"
        />
      </div>

      {/* Version Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : versions && versions.length > 0 ? (
        <ReorderableGrid versions={versions} onDragEnd={onDragEnd} actions={actions} />
      ) : (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary mb-6">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No versions installed</h3>
            <p className="text-muted-foreground mt-2 max-w-sm">
              Get started by browsing available builds in the Catalog and downloading your first
              llama.cpp version.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Paste Confirmation Dialog */}
      <Dialog open={pasteTarget !== null} onOpenChange={(open) => !open && setPasteTarget(null)}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue" />
              Paste Settings
            </DialogTitle>
            <DialogDescription>
              This will replace the current settings of this card with the copied settings (title,
              color, config, override). This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasteTarget(null)} disabled={isPasting}>
              Cancel
            </Button>
            <Button onClick={handlePasteConfirm} disabled={isPasting}>
              {isPasting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Pasting...
                </>
              ) : (
                'Paste'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red" />
              Delete Version
            </DialogTitle>
            <DialogDescription>
              This will permanently remove the installed version and all associated files. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={isDeleting}>
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
