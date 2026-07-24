import { useState } from 'react';
import { useConfigs } from '@/hooks/useConfigs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  FileStack, Search, X, FileText, Terminal, Loader2, Trash2,
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { deleteLaunchConfig } from '@/services/launchConfig';
import { deleteCustomCommand } from '@/services/customCommand';
import { useToast } from '@/hooks/use-toast';
import { formatRelativeTime } from '@/utils/format';
import type { ConfigEntry } from '@/types';

export function ConfigsPage() {
  const { entries, isLoading, search, setSearch, filter, setFilter, totalCount, refetch } = useConfigs();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<ConfigEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === 'launch') {
        await deleteLaunchConfig(deleteTarget.id);
      } else {
        await deleteCustomCommand(deleteTarget.id);
      }
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
          {(['all', 'launch', 'custom'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter(f)}
              className="text-xs h-7 px-3"
            >
              {f === 'all' ? 'All' : f === 'launch' ? 'Launch' : 'Custom'}
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
                : 'Create your first config from the Dashboard using "Create Config".'}
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
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={`${entry.type}-${entry.id}`} className="border-border/50">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {entry.type === 'launch' ? (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Terminal className="h-4 w-4 text-muted-foreground" />
                      )}
                      {entry.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={entry.type === 'launch' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {entry.type === 'launch' ? 'Launch Config' : 'Custom Command'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {entry.description || '\u2014'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {formatRelativeTime(entry.createdAt)}
                  </TableCell>
                  <TableCell>
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
    </div>
  );
}
