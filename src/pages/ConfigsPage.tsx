import { useState } from 'react';
import { useConfigs } from '@/hooks/useConfigs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  FileStack, Search, X, Terminal, Loader2, Trash2, Pencil, Plus,
} from 'lucide-react';
import { CustomCommandModal } from '@/components/CustomCommand/CustomCommandModal';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { deleteCustomCommand } from '@/services/customCommand';
import { useToast } from '@/hooks/use-toast';
import { formatRelativeTime } from '@/utils/format';
import { getColorPalette } from '@/themes';
import { useAppStore } from '@/store/useAppStore';
import type { ConfigEntry } from '@/types';

export function ConfigsPage() {
  const { entries, isLoading, search, setSearch, filter, setFilter, totalCount, refetch } = useConfigs();
  const { activeTheme } = useAppStore();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<ConfigEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ConfigEntry | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const colorPalette = getColorPalette(activeTheme);

  function getColorHex(colorKey: string): string {
    if (!colorKey) return '';
    const match = colorPalette.find(c => c.key === colorKey);
    return match?.hex || '';
  }

  const editingCustomCommand = editingEntry
    ? {
        id: editingEntry.id,
        name: editingEntry.name,
        command: editingEntry.command || '',
        description: editingEntry.description,
        color: editingEntry.color,
        createdAt: editingEntry.createdAt,
      }
    : null;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteCustomCommand(deleteTarget.id);
      toast({ title: 'Deleted', description: `"${deleteTarget.name}" has been removed.` });
      await refetch();
    } catch (err) {
      toast({ title: 'Delete failed', description: String(err), variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Configs</h1>
          <p className="text-muted-foreground mt-1">
            Browse and manage your saved configurations.
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
            <DropdownMenuItem onClick={() => setIsCreateOpen(true)}>
              <Terminal className="h-4 w-4" />
              Create Custom Command
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filter Bar */}
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

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileStack className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-1">
              {search || filter !== 'all' ? 'No matching configs' : 'No configs yet'}
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {search || filter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Click "Create Config" above to add your first configuration.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 bg-card/50">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={`${entry.type}-${entry.id}`} className="border-border/50">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-muted-foreground" />
                      {entry.color && (
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getColorHex(entry.color) }}
                        />
                      )}
                      {entry.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      Custom Command
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {entry.description || '\u2014'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {formatRelativeTime(entry.createdAt)}
                  </TableCell>
                  <TableCell className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingEntry(entry)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(entry)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
       )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red" />
              Delete Config
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
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

      {/* Create Custom Command Modal */}
      <CustomCommandModal
        open={isCreateOpen}
        onOpenChange={(open) => {
          if (!open) refetch();
          setIsCreateOpen(open);
        }}
      />

      {/* Edit Custom Command Modal */}
      <CustomCommandModal
        open={editingEntry !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingEntry(null);
            refetch();
          }
        }}
        editingCommand={editingCustomCommand}
      />
    </div>
  );
}
