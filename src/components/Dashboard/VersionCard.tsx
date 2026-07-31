import { useCallback, useState } from 'react';
import { emit } from '@tauri-apps/api/event';
import { useToast } from '@/hooks/use-toast';
import { saveCardCustomization, deleteCardCustomization } from '@/services/version';
import { useTerminalLaunch } from '@/hooks/Dashboard/useTerminalLaunch';
import { useServerStatus } from '@/hooks/Dashboard/useServerStatus';
import type { InstalledVersion, ConfigEntry, VersionOverride } from '@/types';
import { getBackendColor } from '@/utils/backendColors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Trash2,
  List,
  Terminal,
  SlidersHorizontal,
  Pencil,
  Play,
  Square,
  Settings,
  Copy,
  CopyCheck,
  ClipboardCheck,
  GripVertical,
} from 'lucide-react';
import { VersionConfigDisplay } from './VersionConfigDisplay';
import OverrideDialog from './OverrideDialog';
import { useDashboardContext } from './DashboardContext';
import { HEADER_COLORS, TEXT_COLORS } from './cardTheme';
import type { VersionCardActions } from './ReorderableGrid';
import type { DragHandleProps } from './SortableCardItem';

/**
 * VersionCard now only needs `version` + `actions` object.
 * All shared state (customization, override, config, clipboard, editing)
 * comes from DashboardContext.
 * Optional `dragHandleProps` injected by SortableCardItem for drag-and-drop.
 */
interface VersionCardProps {
  version: InstalledVersion;
  actions: VersionCardActions;
  dragHandleProps?: DragHandleProps;
}

export function VersionCard({ version, actions, dragHandleProps }: VersionCardProps) {
  const { toast } = useToast();
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);

  // ─── All shared state from context ───
  const {
    cardCustomizations,
    setCustomization,
    versionOverrides,
    setOverride,
    getLink,
    configs,
    configsLoading,
    setLink,
    removeLink,
    clipboardData,
    editingDropdownId,
    tempTitle,
    tempColor,
    tempTextColor,
    openEditDropdown,
    closeEditDropdown,
    setTempTitle,
    setTempColor,
    setTempTextColor,
    modelFolder,
    mmprojFolder,
  } = useDashboardContext();

  const customization = cardCustomizations[version.id];
  const override = versionOverrides[version.id] ?? null;
  const configLink = getLink(version.id) ?? null;

  const { handleToggle, hasSession, hasConfig } = useTerminalLaunch({
    version,
    configLink,
    configs,
    override,
    onError: (message: string) => {
      toast({
        variant: 'destructive',
        title: 'Play Error',
        description: message,
      });
    },
  });

  // Reactive server status badge (FR-003) — driven by useServerStatus for extensibility
  const { status: serverStatus } = useServerStatus(version.id);

  const isEditing = editingDropdownId === version.id;
  const activeCustomization = isEditing
    ? { title: tempTitle, header_color: tempColor, text_color: tempTextColor }
    : customization;
  const headerColorObj = HEADER_COLORS.find((c) => c.name === activeCustomization?.header_color);
  const headerBg = headerColorObj?.variable ?? 'hsl(var(--secondary))';
  const displayTitle = activeCustomization?.title || '\u00A0';
  const displayTextColor = activeCustomization?.text_color || undefined;

  // Config lookup: config_id (string) matches ConfigEntry.id (string)
  const linkedConfig = configLink
    ? configs.find((c) => c.type === configLink.config_type && c.id === configLink.config_id)
    : undefined;

  const openCustomizeDropdown = () => {
    openEditDropdown(version.id, customization);
  };

  const saveCustomization = async () => {
    const trimmed = tempTitle.trim();
    try {
      if (trimmed === '' && tempColor === '' && tempTextColor === '') {
        await deleteCardCustomization(version.id);
        setCustomization(version.id, undefined);
      } else {
        await saveCardCustomization(version.id, trimmed, tempColor, tempTextColor);
        setCustomization(version.id, {
          version_id: version.id,
          title: trimmed,
          header_color: tempColor,
          text_color: tempTextColor,
        });
      }
      closeEditDropdown();
      emit('card-customizations-update', null).catch(() => {});
    } catch (err) {
      console.error('Failed to save customization:', err);
      toast({
        title: 'Error',
        description: 'Failed to save card customization.',
      });
    }
  };

  const resetCustomization = async () => {
    try {
      await deleteCardCustomization(version.id);
      setCustomization(version.id, undefined);
      closeEditDropdown();
      emit('card-customizations-update', null).catch(() => {});
    } catch (err) {
      console.error('Failed to reset customization:', err);
      toast({
        title: 'Error',
        description: 'Failed to reset card customization.',
      });
    }
  };

  const handleSelectConfig = async (config: ConfigEntry) => {
    try {
      await setLink(version.id, config.type, config.id);
      toast({
        title: config.name,
        description: `Linked: ${config.name}`,
      });
    } catch (err) {
      console.error('Failed to link config:', err);
      toast({
        title: 'Error',
        description: 'Failed to link config to version.',
      });
    }
  };

  const handleClearConfig = async () => {
    try {
      await removeLink(version.id);
      toast({
        title: 'Config cleared',
        description: 'Config link removed from this version.',
      });
    } catch (err) {
      console.error('Failed to clear config:', err);
    }
  };

  const handleOverrideSave = useCallback(
    (newOverride: VersionOverride | null) => {
      setOverride(version.id, newOverride);
      if (newOverride) {
        toast({
          title: 'Override saved',
          description: `Override applied to ${version.build_number}.`,
        });
      } else {
        toast({
          title: 'Override cleared',
          description: `Override removed from ${version.build_number}.`,
        });
      }
    },
    [version.id, version.build_number, setOverride, toast]
  );

  const hasOverride = override !== null && (override.model_path || override.mmproj_path);

  // Paste button visibility: clipboard has data AND this card is not the source
  const canPaste = clipboardData !== null && clipboardData.sourceVersionId !== version.id;

  // Extract override file names for separate badges
  const overrideModelName = override?.model_path
    ? (override.model_path.split('\\').pop()?.split('/').pop() ?? 'model.gguf')
    : null;
  const overrideMmprojName = override?.mmproj_path
    ? (override.mmproj_path.split('\\').pop()?.split('/').pop() ?? 'mmproj.mmproj')
    : null;

  return (
    <Card className="border-border/50 bg-card/50 hover:border-border/80 transition-colors group overflow-hidden flex flex-col">
      {/* Colored Header Bar */}
      <div
        className="px-3 py-2 flex items-center justify-between rounded-t-xl"
        style={{ backgroundColor: headerBg }}
      >
        {/* Left side: drag handle + title */}
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {dragHandleProps && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-black/60 hover:text-black hover:bg-black/10 shrink-0 cursor-grab active:cursor-grabbing"
              title="Drag to reorder"
              {...dragHandleProps.attributes}
              {...dragHandleProps.listeners}
            >
              <GripVertical className="h-3 w-3" />
            </Button>
          )}
          <p
            className="text-sm font-medium text-foreground truncate"
            style={{ color: displayTextColor || undefined }}
          >
            {displayTitle}
          </p>
        </div>
        {/* Right side: action buttons */}
        <div className="flex items-center gap-1">
          {canPaste && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
              title="Paste settings"
              onClick={() => actions.onPasteRequest(version.id)}
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
            </Button>
          )}
          <DropdownMenu
            open={editingDropdownId === version.id}
            onOpenChange={(open) => {
              if (open) {
                openCustomizeDropdown();
              } else {
                closeEditDropdown();
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-black/80 hover:text-black hover:bg-black/10"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Customize Card</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <Input
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  placeholder="Enter title..."
                  aria-label="Card title"
                  className="h-8 text-sm"
                />
              </div>
              <DropdownMenuSeparator />
              <div className="px-2 py-1">
                <p className="text-xs text-muted-foreground mb-1.5">Header Color</p>
                <div className="flex flex-wrap gap-2">
                  {/* Default (original) color swatch */}
                  <button
                    key="default"
                    onClick={() => setTempColor('')}
                    aria-label="Default color"
                    className={`h-6 w-6 rounded-full border-2 transition-all ${
                      tempColor === '' ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: 'hsl(var(--secondary))' }}
                    title="Default"
                  />
                  {HEADER_COLORS.map((color) => (
                    <button
                      key={color.name}
                      onClick={() => setTempColor(color.name)}
                      aria-label={color.label}
                      className={`h-6 w-6 rounded-full border-2 transition-all ${
                        tempColor === color.name ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color.variable }}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
              <DropdownMenuSeparator />
              <div className="px-2 py-1">
                <p className="text-xs text-muted-foreground mb-1.5">Text Color</p>
                <div className="flex gap-2">
                  {TEXT_COLORS.map((color) => (
                    <button
                      key={color.name}
                      onClick={() => setTempTextColor(color.name)}
                      className={`h-6 w-6 rounded-full border-2 shadow-md ring-1 ring-gray-300 transition-all ${
                        tempTextColor === color.name ? 'border-white scale-110' : 'border-border'
                      }`}
                      style={{ backgroundColor: color.variable }}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
              <DropdownMenuSeparator />
              <div className="flex gap-2 px-2 pb-1">
                <DropdownMenuItem onClick={saveCustomization} className="flex-1 justify-center">
                  Apply
                </DropdownMenuItem>
                <DropdownMenuItem onClick={resetCustomization} className="flex-1 justify-center">
                  Reset
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Config Display */}
      <VersionConfigDisplay
        link={configLink ?? null}
        configName={linkedConfig?.name}
        configColor={linkedConfig?.color}
      />

      {/* Override Badge */}
      {hasOverride && (
        <div className="px-3 pt-1.5 pb-1.5">
          <Badge variant="outline" className="border-iris/30 text-iris text-xs gap-1 max-w-full">
            <SlidersHorizontal className="h-3 w-3 shrink-0" />
            <div className="flex flex-wrap items-center gap-1 min-w-0 line-clamp-2">
              {overrideModelName && (
                <span className="truncate" title={`Model: ${overrideModelName}`}>
                  Model: {overrideModelName}
                </span>
              )}
              {overrideMmprojName && (
                <span className="truncate" title={`MMProj: ${overrideMmprojName}`}>
                  MMProj: {overrideMmprojName}
                </span>
              )}
            </div>
          </Badge>
        </div>
      )}

      {/* Server Status Badge (FR-003) — extensible: add new statuses in serverStatusMachine only */}
      {serverStatus !== 'stopped' && (
        <div className="px-3 pb-1.5">
          <Badge
            variant="outline"
            className={`text-xs gap-1 items-center ${
              serverStatus === 'running'
                ? 'border-green/30 text-green'
                : serverStatus === 'stopping'
                  ? 'border-amber/30 text-amber'
                  : serverStatus === 'starting'
                    ? 'border-blue/30 text-blue'
                    : 'border-red/30 text-red'
            }`}
          >
            <span
              className={`block h-1.5 w-1.5 rounded-full animate-pulse shrink-0 ${
                serverStatus === 'running'
                  ? 'bg-green'
                  : serverStatus === 'stopping'
                    ? 'bg-amber'
                    : serverStatus === 'starting'
                      ? 'bg-blue'
                      : 'bg-red'
              }`}
            />
            {serverStatus === 'running'
              ? 'Running'
              : serverStatus === 'stopping'
                ? 'Stopping...'
                : serverStatus === 'starting'
                  ? 'Starting...'
                  : 'Error'}
          </Badge>
        </div>
      )}

      <div className="flex-1 flex flex-col justify-end">
        <CardHeader className="pb-3 pt-6">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">Version</p>
            <p className="font-mono font-semibold text-lg truncate">{version.build_number}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="outline" className={`border ${getBackendColor(version.backend)}`}>
                {version.backend}
              </Badge>
              <Badge variant="outline" className="border text-muted-foreground text-xs">
                {version.architecture}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 gap-2">
                  <List className="h-4 w-4" />
                  Config
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Select Config</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {configsLoading ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                    Loading...
                  </div>
                ) : configs.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                    No configs
                  </div>
                ) : (
                  configs.map((config) => (
                    <DropdownMenuItem
                      key={`${config.type}-${config.id}`}
                      onClick={() => handleSelectConfig(config)}
                    >
                      <Terminal className="h-4 w-4" />
                      <span className="truncate">{config.name}</span>
                      {configLink?.config_type === config.type &&
                        configLink?.config_id === config.id && (
                          <span className="ml-auto text-xs text-green">Active</span>
                        )}
                    </DropdownMenuItem>
                  ))
                )}
                {configLink && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleClearConfig} className="text-red">
                      <Trash2 className="h-4 w-4" />
                      Clear Config
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              className={`flex-1 gap-2 ${hasOverride ? 'border-iris/50 text-iris' : ''}`}
              onClick={() => setOverrideDialogOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Override
            </Button>
          </div>

          <Separator className="border-border/50" />

          <div className="flex items-center gap-2 mt-auto">
            <Button
              variant={hasSession ? 'destructive' : 'outline'}
              size="sm"
              className="flex-1 gap-2"
              onClick={handleToggle}
              disabled={!hasConfig}
              aria-label={
                hasConfig
                  ? hasSession
                    ? 'Stop server'
                    : 'Start server'
                  : 'Link a configuration first to enable Play'
              }
              title={
                hasConfig
                  ? hasSession
                    ? 'Stop server'
                    : 'Start server'
                  : 'Link a configuration first to enable Play'
              }
            >
              {hasSession ? (
                <>
                  <Square className="h-4 w-4" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Play
                </>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-muted-foreground hover:text-foreground hover:bg-secondary"
                  title="Actions"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => actions.onDuplicateClick(version.id, false)}>
                  <Copy className="h-4 w-4" />
                  <span>Clone Empty</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.onDuplicateClick(version.id, true)}>
                  <CopyCheck className="h-4 w-4" />
                  <span>Clone with Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.onCopyClick(version.id)}>
                  <Copy className="h-4 w-4" />
                  <span>Copy Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red focus:text-red focus:bg-red/10"
                  onClick={() => actions.onDeleteClick(version.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </div>

      <OverrideDialog
        open={overrideDialogOpen}
        onOpenChange={setOverrideDialogOpen}
        versionId={version.id}
        versionName={version.build_number}
        modelFolder={modelFolder}
        mmprojFolder={mmprojFolder}
        currentOverride={override}
        onSave={handleOverrideSave}
      />
    </Card>
  );
}
