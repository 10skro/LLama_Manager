import { useState } from 'react';
import { useConfigs } from '@/hooks/useConfigs';
import { Button } from '@/components/ui/button';
import { Terminal, Plus } from 'lucide-react';
import { CustomCommandModal } from '@/components/CustomCommand/CustomCommandModal';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { deleteCustomCommand } from '@/services/customCommand';
import { useToast } from '@/hooks/use-toast';
import { getColorPalette } from '@/themes';
import { useAppStore } from '@/store/useAppStore';
import type { ConfigEntry } from '@/types';
import { ConfigFilterBar, ConfigTable, DeleteConfirmDialog } from '@/components/Configs';

export function ConfigsPage() {
  const { entries, isLoading, search, setSearch, filter, setFilter, totalCount, refetch } =
    useConfigs();
  const { activeTheme } = useAppStore();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<ConfigEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ConfigEntry | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const colorPalette = getColorPalette(activeTheme);

  function getColorHex(colorKey: string): string {
    if (!colorKey) return '';
    const match = colorPalette.find((c) => c.key === colorKey);
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
          <p className="text-muted-foreground mt-1">Browse and manage your saved configurations.</p>
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
      <ConfigFilterBar
        search={search}
        setSearch={setSearch}
        filter={filter}
        setFilter={setFilter}
        totalCount={totalCount}
      />

      {/* Table */}
      <ConfigTable
        entries={entries}
        isLoading={isLoading}
        search={search}
        filter={filter}
        getColorHex={getColorHex}
        onEdit={(entry) => setEditingEntry(entry)}
        onDelete={(entry) => setDeleteTarget(entry)}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        name={deleteTarget?.name ?? ''}
        isOpen={deleteTarget !== null}
        isDeleting={isDeleting}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

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
