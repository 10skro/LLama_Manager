import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useInstalledVersions } from '@/hooks/useInstalledVersions';

import { useToast } from '@/hooks/use-toast';
import { uninstallVersion, openFolder, getCardCustomizations, saveCardCustomization, deleteCardCustomization } from '@/services/version';
import type { CardCustomization } from '@/types';
import { getBackendColor } from '@/utils/backendColors';
import { formatDate } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { LaunchConfigModal } from '@/components/LaunchConfig';
import {
  Package, FolderOpen, Trash2, Settings,
  Loader2,
  HardDrive, Calendar, Cpu, Plus, Download, FileText,
  Pencil,
} from 'lucide-react';

function truncatePath(path: string, maxLen: number = 40): string {
  if (path.length <= maxLen) return path;
  const parts = path.split('\\');
  if (parts.length <= 3) return path.substring(0, maxLen) + '...';
  return `${parts[0]}\\...\\${parts[parts.length - 2]}\\${parts[parts.length - 1]}`;
}

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

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: versions, isLoading } = useInstalledVersions();

  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLaunchConfigOpen, setIsLaunchConfigOpen] = useState(false);
  // Card customizations per version (versionId -> { title, headerColor, textColor })
  const [cardCustomizations, setCardCustomizations] = useState<Record<number, CardCustomization>>({});
  // Which card's customize dropdown is open
  const [editingDropdownId, setEditingDropdownId] = useState<number | null>(null);
  // Temporary values being edited in the dropdown
  const [tempTitle, setTempTitle] = useState('');
  const [tempColor, setTempColor] = useState('');
  const [tempTextColor, setTempTextColor] = useState('');

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

  const openCustomizeDropdown = (versionId: number) => {
    const existing = cardCustomizations[versionId];
    setEditingDropdownId(versionId);
    setTempTitle(existing?.title ?? '');
    setTempColor(existing?.header_color ?? '');
    setTempTextColor(existing?.text_color ?? '');
  };

  const closeDropdown = () => {
    setEditingDropdownId(null);
    setTempTitle('');
    setTempColor('');
    setTempTextColor('');
  };

  const saveCustomization = async () => {
    if (editingDropdownId === null) return;
    const trimmed = tempTitle.trim();
    try {
      if (trimmed === '' && tempColor === '' && tempTextColor === '') {
        await deleteCardCustomization(editingDropdownId);
        setCardCustomizations(prev => {
          const next = { ...prev };
          delete next[editingDropdownId];
          return next;
        });
      } else {
        await saveCardCustomization(editingDropdownId, trimmed, tempColor, tempTextColor);
        setCardCustomizations(prev => {
          const next = { ...prev };
          next[editingDropdownId] = {
            version_id: editingDropdownId,
            title: trimmed,
            header_color: tempColor,
            text_color: tempTextColor,
          };
          return next;
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
    if (editingDropdownId === null) return;
    try {
      await deleteCardCustomization(editingDropdownId);
      setCardCustomizations(prev => {
        const next = { ...prev };
        delete next[editingDropdownId];
        return next;
      });
      closeDropdown();
    } catch (err) {
      console.error('Failed to reset customization:', err);
      toast({
        title: 'Error',
        description: 'Failed to reset card customization.',
      });
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
              Create Launch Config
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
          {versions.map((version) => {
            // Determine display values: use temp values for live preview when editing this card
            const isEditing = editingDropdownId === version.id;
            const activeCustomization = isEditing
              ? { title: tempTitle, header_color: tempColor, text_color: tempTextColor }
              : cardCustomizations[version.id];
            const headerColorObj = HEADER_COLORS.find(c => c.name === activeCustomization?.header_color);
            const headerBg = headerColorObj?.variable ?? 'hsl(var(--secondary))';
            const displayTitle = activeCustomization?.title || '\u00A0';
            const displayTextColor = activeCustomization?.text_color || undefined;

            return (
              <Card
                key={version.id}
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
                          openCustomizeDropdown(version.id);
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
                          {HEADER_COLORS.map(color => (
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
                          <button
                            onClick={() => setTempTextColor('white')}
                            className={`h-6 w-6 rounded-full border-2 bg-white shadow-md ring-1 ring-gray-300 transition-all ${tempTextColor === 'white' ? 'border-white scale-110' : 'border-border'}`}
                            title="White"
                          />
                          <button
                            onClick={() => setTempTextColor('black')}
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toast({ title: 'Load Config', description: 'Coming soon.' })}>
                          <Download className="h-4 w-4" />
                          Load Config
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
    </div>
  );
}
