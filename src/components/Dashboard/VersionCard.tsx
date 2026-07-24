import { useToast } from '@/hooks/use-toast';
import { saveCardCustomization, deleteCardCustomization } from '@/services/version';
import { useTerminalLaunch } from '@/hooks/useTerminalLaunch';
import { useAppStore } from '@/store/useAppStore';
import type { InstalledVersion, CardCustomization, ConfigEntry, VersionConfigLink } from '@/types';
import { getBackendColor } from '@/utils/backendColors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Package, Trash2, List,
  FileText, Terminal, SlidersHorizontal, Pencil,
  Play,
} from 'lucide-react';
import { VersionConfigDisplay } from './VersionConfigDisplay';

const HEADER_COLORS = [
  { name: 'mauve', variable: 'hsl(var(--mauve))', label: 'Mauve' },
  { name: 'red', variable: 'hsl(var(--red))', label: 'Red' },
  { name: 'pink', variable: 'hsl(var(--pink))', label: 'Pink' },
  { name: 'peach', variable: 'hsl(var(--peach))', label: 'Peach' },
  { name: 'yellow', variable: 'hsl(var(--yellow))', label: 'Yellow' },
  { name: 'green', variable: 'hsl(var(--green))', label: 'Green' },
  { name: 'teal', variable: 'hsl(var(--teal))', label: 'Teal' },
  { name: 'blue', variable: 'hsl(var(--blue))', label: 'Blue' },
  { name: 'lavender', variable: 'hsl(var(--lavender))', label: 'Lavender' },
  { name: 'love', variable: 'hsl(var(--love))', label: 'Love' },
  { name: 'iris', variable: 'hsl(var(--iris))', label: 'Iris' },
  { name: 'pine', variable: 'hsl(var(--pine))', label: 'Pine' },
];

interface VersionCardProps {
  version: InstalledVersion;
  customization?: CardCustomization;
  onCustomizationChange: (versionId: number, customization?: CardCustomization) => void;
  onDeleteClick: (versionId: number) => void;
  // Shared state for editing dropdown (only one card can edit at a time)
  editingDropdownId: number | null;
  onEditingDropdownChange: (id: number | null) => void;
  tempTitle: string;
  onTempTitleChange: (title: string) => void;
  tempColor: string;
  onTempColorChange: (color: string) => void;
  tempTextColor: string;
  onTempTextColorChange: (color: string) => void;
  // Lifted config state (shared across all cards)
  configLink: VersionConfigLink | null;
  configs: ConfigEntry[];
  configsLoading: boolean;
  onSetLink: (versionId: number, configType: 'launch' | 'custom', configId: string) => Promise<void>;
  onRemoveLink: (versionId: number) => Promise<void>;
}

export function VersionCard({
  version,
  customization,
  onCustomizationChange,
  onDeleteClick,
  editingDropdownId,
  onEditingDropdownChange,
  tempTitle,
  onTempTitleChange,
  tempColor,
  onTempColorChange,
  tempTextColor,
  onTempTextColorChange,
  configLink,
  configs,
  configsLoading,
  onSetLink,
  onRemoveLink,
}: VersionCardProps) {
  const { toast } = useToast();
  const launchConfigs = useAppStore((state) => state.launchConfigs);
  const customCommands = useAppStore((state) => state.customCommands);

  const { handlePlay, hasConfig } = useTerminalLaunch({
    version,
    configLink,
    launchConfigs,
    customCommands,
    onError: (message: string) => {
      toast({
        variant: 'destructive',
        title: 'Play Error',
        description: message,
      });
    },
  });

  const isEditing = editingDropdownId === version.id;
  const activeCustomization = isEditing
    ? { title: tempTitle, header_color: tempColor, text_color: tempTextColor }
    : customization;
  const headerColorObj = HEADER_COLORS.find(c => c.name === activeCustomization?.header_color);
  const headerBg = headerColorObj?.variable ?? 'hsl(var(--secondary))';
  const displayTitle = activeCustomization?.title || '\u00A0';
  const displayTextColor = activeCustomization?.text_color || undefined;

  // Config lookup: config_id (string) matches ConfigEntry.id (string)
  const linkedConfig = configLink
    ? configs.find(c => c.type === configLink.config_type && c.id === configLink.config_id)
    : undefined;

  const openCustomizeDropdown = () => {
    const existing = customization;
    onEditingDropdownChange(version.id);
    onTempTitleChange(existing?.title ?? '');
    onTempColorChange(existing?.header_color ?? '');
    onTempTextColorChange(existing?.text_color ?? '');
  };

  const closeDropdown = () => {
    onEditingDropdownChange(null);
    onTempTitleChange('');
    onTempColorChange('');
    onTempTextColorChange('');
  };

  const saveCustomization = async () => {
    const trimmed = tempTitle.trim();
    try {
      if (trimmed === '' && tempColor === '' && tempTextColor === '') {
        await deleteCardCustomization(version.id);
        onCustomizationChange(version.id, undefined);
      } else {
        await saveCardCustomization(version.id, trimmed, tempColor, tempTextColor);
        onCustomizationChange(version.id, {
          version_id: version.id,
          title: trimmed,
          header_color: tempColor,
          text_color: tempTextColor,
        });
      }
      closeDropdown();
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
      onCustomizationChange(version.id, undefined);
      closeDropdown();
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
      await onSetLink(version.id, config.type, config.id);
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
      await onRemoveLink(version.id);
      toast({
        title: 'Config cleared',
        description: 'Config link removed from this version.',
      });
    } catch (err) {
      console.error('Failed to clear config:', err);
    }
  };

  return (
    <Card
      className="border-border/50 bg-card/50 hover:border-border/80 transition-colors group overflow-hidden"
    >
      {/* Colored Header Bar */}
      <div
        className="px-3 py-2 flex items-center justify-between rounded-t-xl"
        style={{ backgroundColor: headerBg }}
      >
        <p
          className="text-sm font-medium text-foreground truncate flex-1"
          style={{ color: displayTextColor || undefined }}
        >
          {displayTitle}
        </p>
        <DropdownMenu
          open={editingDropdownId === version.id}
          onOpenChange={(open) => {
            if (open) {
              openCustomizeDropdown();
            } else {
              closeDropdown();
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
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
                onChange={(e) => onTempTitleChange(e.target.value)}
                placeholder="Enter title..."
                aria-label="Card title"
                className="h-8 text-sm"
              />
            </div>
            <DropdownMenuSeparator />
            <div className="px-2 py-1">
              <p className="text-xs text-muted-foreground mb-1.5">Header Color</p>
              <div className="flex flex-wrap gap-2">
                {HEADER_COLORS.map(color => (
                  <button
                    key={color.name}
                    onClick={() => onTempColorChange(color.name)}
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
                <button
                  onClick={() => onTempTextColorChange('white')}
                  className={`h-6 w-6 rounded-full border-2 bg-white shadow-md ring-1 ring-gray-300 transition-all ${tempTextColor === 'white' ? 'border-white scale-110' : 'border-border'}`}
                  title="White"
                />
                <button
                  onClick={() => onTempTextColorChange('black')}
                  className={`h-6 w-6 rounded-full border-2 bg-black transition-all ${tempTextColor === 'black' ? 'border-white scale-110' : 'border-border'}`}
                  title="Black"
                />
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

      {/* Config Display */}
      <VersionConfigDisplay
        link={configLink ?? null}
        configName={linkedConfig?.name}
      />

      <CardHeader className="pb-3 pt-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <Package className="h-5 w-5 text-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono font-semibold text-lg">
              {version.build_number}
            </p>
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={`border ${getBackendColor(version.backend)}`}
              >
                {version.backend}
              </Badge>
              <Badge variant="outline" className="border text-muted-foreground text-xs">
                {version.architecture}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
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
                    {config.type === 'launch' ? (
                      <FileText className="h-4 w-4" />
                    ) : (
                      <Terminal className="h-4 w-4" />
                    )}
                    <span className="truncate">{config.name}</span>
                    {configLink?.config_type === config.type && configLink?.config_id === config.id && (
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
            className="gap-2 opacity-60 hover:opacity-80"
            onClick={() =>
              toast({
                title: 'Override',
                description: 'Override settings are work in progress.',
              })
            }
          >
            <SlidersHorizontal className="h-4 w-4" />
            Override
          </Button>
        </div>

        <Separator className="border-border/50" />

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            onClick={handlePlay}
            disabled={!hasConfig}
            aria-label={hasConfig ? 'Run configuration in terminal' : 'Link a configuration first to enable Play'}
            title={hasConfig ? 'Run configuration in terminal' : 'Link a configuration first to enable Play'}
          >
            <Play className="h-4 w-4" />
            Play
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-red hover:text-red/80 hover:bg-red/10 border-red/20"
            onClick={() => onDeleteClick(version.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
