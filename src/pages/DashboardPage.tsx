import { useState, useEffect } from 'react';
import { emit } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';
import { useInstalledVersions } from '@/hooks/useInstalledVersions';
import { useStorageUsage } from '@/hooks/useStorageUsage';
import { useLatestBuildInfo } from '@/hooks/useLatestBuildInfo';
import { useVersionConfigLinks } from '@/hooks/useVersionConfigLinks';
import { useConfigs } from '@/hooks/useConfigs';

import { useToast } from '@/hooks/use-toast';
import { uninstallVersion, getCardCustomizations, duplicateVersion, saveCardCustomization, bulkSetDisplayOrder, resetDisplayOrder } from '@/services/version';
import { getVersionOverride, saveVersionOverride } from '@/services/versionOverride';
import { saveVersionConfigLink } from '@/services/versionConfig';
import type { CardCustomization, VersionOverride, CardClipboardData } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { formatSize } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

import { VersionCard } from '@/components/Dashboard/VersionCard';
import {
  Package, Trash2,
  Loader2,
  HardDrive, Cpu,
  GripVertical,
  RotateCcw,
} from 'lucide-react';
import { ToastAction } from '@/components/ui/toast';

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: versions, isLoading } = useInstalledVersions();
  const { storageUsage, isLoading: storageLoading } = useStorageUsage();
  const { latestInstalled } = useLatestBuildInfo();
  const settings = useAppStore((state) => state.settings);

  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Copy/paste clipboard state
  const [clipboardData, setClipboardData] = useState<CardClipboardData | null>(null);
  const [pasteTarget, setPasteTarget] = useState<number | null>(null);
  const [isPasting, setIsPasting] = useState(false);
  // Card customizations per version (versionId -> customization)
  const [cardCustomizations, setCardCustomizations] = useState<Record<number, CardCustomization>>({});
  // Version overrides per version (versionId -> override)
  const [versionOverrides, setVersionOverrides] = useState<Record<number, VersionOverride>>({});
  // Shared editing state: only one card's customize dropdown can be open at a time
  const [editingDropdownId, setEditingDropdownId] = useState<number | null>(null);
  const [tempTitle, setTempTitle] = useState('');
  const [tempColor, setTempColor] = useState('');
  const [tempTextColor, setTempTextColor] = useState('');
  // Reorder mode: drag-and-drop card reordering
  const [reorderMode, setReorderMode] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

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

  // --- Copy / Paste handlers ---

  const handleCopy = (versionId: number) => {
    const custom = cardCustomizations[versionId];
    const link = getLink(versionId);
    const override = versionOverrides[versionId];

    const data: CardClipboardData = {
      sourceVersionId: versionId,
    };

    if (custom && (custom.title || custom.header_color || custom.text_color)) {
      data.customization = {
        title: custom.title,
        header_color: custom.header_color,
        text_color: custom.text_color,
      };
    }

    if (link) {
      data.configLink = {
        config_type: link.config_type,
        config_id: link.config_id,
      };
    }

    if (override) {
      data.override = {
        model_path: override.model_path,
        mmproj_path: override.mmproj_path,
      };
    }

    setClipboardData(data);
    toast({
      title: 'Settings copied',
      description: 'Card settings are ready to paste on another card.',
      duration: 0,
      action: (
        <ToastAction
          altText="Cancel copy"
          onClick={() => {
            setClipboardData(null);
          }}
        >
          Cancel
        </ToastAction>
      ),
    });
  };

  const handlePasteRequest = (targetVersionId: number) => {
    if (!clipboardData) return;
    setPasteTarget(targetVersionId);
  };

  const handlePasteConfirm = async () => {
    if (!clipboardData || pasteTarget === null) return;
    setIsPasting(true);
    try {
      const targetId = pasteTarget;

      // 1. Paste customization
      if (clipboardData.customization) {
        const { title, header_color, text_color } = clipboardData.customization;
        if (title || header_color || text_color) {
          await saveCardCustomization(targetId, title, header_color, text_color);
          setCardCustomizations(prev => ({
            ...prev,
            [targetId]: {
              version_id: targetId,
              title,
              header_color,
              text_color,
            },
          }));
        }
      }

      // 2. Paste config link
      if (clipboardData.configLink) {
        await saveVersionConfigLink(targetId, clipboardData.configLink.config_type, clipboardData.configLink.config_id);
        // Force reload of config links
        if (versions && versions.length > 0) {
          await loadAll(versions.map(v => v.id));
        }
      }

      // 3. Paste override
      if (clipboardData.override) {
        const overrideData = clipboardData.override;
        const hasOverride = overrideData.model_path || overrideData.mmproj_path;
        if (hasOverride) {
          await saveVersionOverride(targetId, overrideData.model_path, overrideData.mmproj_path);
          setVersionOverrides(prev => ({
            ...prev,
            [targetId]: {
              version_id: targetId,
              model_path: overrideData.model_path,
              mmproj_path: overrideData.mmproj_path,
            },
          }));
        }
      }

      // Notify floating terminal window
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
  };

  const handlePasteCancel = () => {
    setPasteTarget(null);
  };

  const handleDuplicate = async (versionId: number, withSettings: boolean) => {
    try {
      await duplicateVersion(versionId, withSettings);
      // Reload customizations so the cloned card's settings appear immediately
      if (withSettings) {
        const customs = await getCardCustomizations();
        const record: Record<number, CardCustomization> = {};
        for (const c of customs) {
          record[c.version_id] = c;
        }
        setCardCustomizations(record);
      }
      // Invalidate installed-versions: triggers reload of versions, config links, and overrides
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

  const handleDragEnd = async (event: { active: { id: number }; over: { id: number } | null }) => {
    const over = event.over;
    if (!over || event.active.id === over.id || !versions) return;

    const oldIndex = versions.findIndex((v) => v.id === event.active.id);
    const newIndex = versions.findIndex((v) => v.id === over.id);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    // Build new ordered list
    const newVersions = [...versions];
    const [moved] = newVersions.splice(oldIndex, 1);
    newVersions.splice(newIndex, 0, moved);

    // Compute display_order: positions 0, 1, 2, ...
    const orders = newVersions.map((v, i) => ({ versionId: v.id, displayOrder: i }));

    setIsReordering(true);
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
    } finally {
      setIsReordering(false);
    }
  };

  const handleResetOrder = async () => {
    setIsReordering(true);
    try {
      await resetDisplayOrder();
      await queryClient.invalidateQueries({ queryKey: ['installed-versions'] });
      setReorderMode(false);
      toast({
        title: 'Order reset',
        description: 'Cards returned to default (newest first) order.',
      });
    } catch (err) {
      console.error('Failed to reset order:', err);
      toast({
        variant: 'destructive',
        title: 'Reset failed',
        description: 'Could not reset the card order.',
      });
    } finally {
      setIsReordering(false);
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
        <div className="flex items-center gap-2">
          {reorderMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetOrder}
              disabled={isReordering}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Order
            </Button>
          )}
          <Button
            variant={reorderMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setReorderMode((p) => !p)}
            className="gap-2"
          >
            <GripVertical className="h-4 w-4" />
            {reorderMode ? 'Exit Reorder' : 'Reorder'}
          </Button>
        </div>
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
              <p className="text-2xl font-semibold truncate">
                {latestInstalled?.build_number ?? '\u2014'}
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
        <ReorderableGrid
          versions={versions}
          reorderMode={reorderMode}
          onDragEnd={handleDragEnd}
          cardCustomizations={cardCustomizations}
          onCustomizationChange={handleCustomizationChange}
          onDeleteClick={setDeleteTarget}
          onDuplicateClick={handleDuplicate}
          editingDropdownId={editingDropdownId}
          onEditingDropdownChange={setEditingDropdownId}
          tempTitle={tempTitle}
          onTempTitleChange={setTempTitle}
          tempColor={tempColor}
          onTempColorChange={setTempColor}
          tempTextColor={tempTextColor}
          onTempTextColorChange={setTempTextColor}
          getLink={getLink}
          configs={configs}
          configsLoading={configsLoading}
          setLink={setLink}
          removeLink={removeLink}
          versionOverrides={versionOverrides}
          onOverrideChange={handleOverrideChange}
          modelFolder={settings?.model_folder}
          mmprojFolder={settings?.mmproj_folder}
          clipboardData={clipboardData}
          onCopyClick={handleCopy}
          onPasteRequest={handlePasteRequest}
        />
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

      {/* Paste Confirmation Dialog */}
      <Dialog open={pasteTarget !== null} onOpenChange={(open) => !open && setPasteTarget(null)}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue" />
              Paste Settings
            </DialogTitle>
            <DialogDescription>
              This will replace the current settings of this card with the copied settings (title, color, config, override). This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handlePasteCancel} disabled={isPasting}>
              Cancel
            </Button>
            <Button
              onClick={handlePasteConfirm}
              disabled={isPasting}
            >
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

/* ─── Reorderable Grid ─────────────────────────────────────────────────── */

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { InstalledVersion, VersionConfigLink, ConfigEntry } from '@/types';

interface ReorderableGridProps {
  versions: InstalledVersion[];
  reorderMode: boolean;
  onDragEnd: (event: { active: { id: number }; over: { id: number } | null }) => void;
  cardCustomizations: Record<number, CardCustomization>;
  onCustomizationChange: (versionId: number, customization?: CardCustomization) => void;
  onDeleteClick: (id: number) => void;
  onDuplicateClick: (versionId: number, withSettings: boolean) => void;
  editingDropdownId: number | null;
  onEditingDropdownChange: (id: number | null) => void;
  tempTitle: string;
  onTempTitleChange: (v: string) => void;
  tempColor: string;
  onTempColorChange: (v: string) => void;
  tempTextColor: string;
  onTempTextColorChange: (v: string) => void;
  getLink: (versionId: number) => VersionConfigLink | undefined;
  configs: ConfigEntry[];
  configsLoading: boolean;
  setLink: (versionId: number, configType: 'custom', configId: string) => Promise<void>;
  removeLink: (versionId: number) => Promise<void>;
  versionOverrides: Record<number, VersionOverride>;
  onOverrideChange: (versionId: number, override: VersionOverride | null) => void;
  modelFolder?: string;
  mmprojFolder?: string;
  clipboardData: CardClipboardData | null;
  onCopyClick: (versionId: number) => void;
  onPasteRequest: (targetVersionId: number) => void;
}

function ReorderableGrid(props: ReorderableGridProps) {
  const {
    versions,
    reorderMode,
    onDragEnd,
    cardCustomizations,
    onCustomizationChange,
    onDeleteClick,
    onDuplicateClick,
    editingDropdownId,
    onEditingDropdownChange,
    tempTitle,
    onTempTitleChange,
    tempColor,
    onTempColorChange,
    tempTextColor,
    onTempTextColorChange,
    getLink,
    configs,
    configsLoading,
    setLink,
    removeLink,
    versionOverrides,
    onOverrideChange,
    modelFolder,
    mmprojFolder,
    clipboardData,
    onCopyClick,
    onPasteRequest,
  } = props;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const renderCards = () => versions.map((version) => (
    <SortableCardItem key={version.id} versionId={version.id}>
      <VersionCard
        version={version}
        customization={cardCustomizations[version.id]}
        onCustomizationChange={onCustomizationChange}
        onDeleteClick={onDeleteClick}
        onDuplicateClick={onDuplicateClick}
        editingDropdownId={editingDropdownId}
        onEditingDropdownChange={onEditingDropdownChange}
        tempTitle={tempTitle}
        onTempTitleChange={onTempTitleChange}
        tempColor={tempColor}
        onTempColorChange={onTempColorChange}
        tempTextColor={tempTextColor}
        onTempTextColorChange={onTempTextColorChange}
        configLink={getLink(version.id) ?? null}
        configs={configs}
        configsLoading={configsLoading}
        onSetLink={setLink}
        onRemoveLink={removeLink}
        override={versionOverrides[version.id] ?? null}
        onOverrideChange={onOverrideChange}
        modelFolder={modelFolder}
        mmprojFolder={mmprojFolder}
        clipboardData={clipboardData}
        onCopyClick={onCopyClick}
        onPasteRequest={onPasteRequest}
      />
    </SortableCardItem>
  ));

  if (!reorderMode) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {versions.map((version) => (
          <VersionCard
            key={version.id}
            version={version}
            customization={cardCustomizations[version.id]}
            onCustomizationChange={onCustomizationChange}
            onDeleteClick={onDeleteClick}
            onDuplicateClick={onDuplicateClick}
            editingDropdownId={editingDropdownId}
            onEditingDropdownChange={onEditingDropdownChange}
            tempTitle={tempTitle}
            onTempTitleChange={onTempTitleChange}
            tempColor={tempColor}
            onTempColorChange={onTempColorChange}
            tempTextColor={tempTextColor}
            onTempTextColorChange={onTempTextColorChange}
            configLink={getLink(version.id) ?? null}
            configs={configs}
            configsLoading={configsLoading}
            onSetLink={setLink}
            onRemoveLink={removeLink}
            override={versionOverrides[version.id] ?? null}
            onOverrideChange={onOverrideChange}
            modelFolder={modelFolder}
            mmprojFolder={mmprojFolder}
            clipboardData={clipboardData}
            onCopyClick={onCopyClick}
            onPasteRequest={onPasteRequest}
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd as any}>
      <SortableContext items={versions.map((v) => v.id)} strategy={verticalListSortingStrategy}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderCards()}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableCardItem({ versionId, children }: { versionId: number; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: versionId,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Drag handle overlay */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-20 flex items-center justify-center w-8 h-8 rounded-md bg-background/80 backdrop-blur-sm border border-border/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}
