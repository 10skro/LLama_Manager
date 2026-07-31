import { FileStack, Terminal, Loader2, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/utils/format';
import type { ConfigEntry } from '@/types';

interface ConfigTableProps {
  entries: ConfigEntry[];
  isLoading: boolean;
  search: string;
  filter: string;
  getColorHex: (colorKey: string) => string;
  onEdit: (entry: ConfigEntry) => void;
  onDelete: (entry: ConfigEntry) => void;
}

export function ConfigTable({
  entries,
  isLoading,
  search,
  filter,
  getColorHex,
  onEdit,
  onDelete,
}: ConfigTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
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
    );
  }

  return (
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
              <TableCell className="font-medium max-w-xs truncate">
                <div className="flex items-center gap-2 truncate">
                  <Terminal className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  {entry.color && (
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getColorHex(entry.color) }}
                    />
                  )}
                  <span className="truncate">{entry.name}</span>
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
                  onClick={() => onEdit(entry)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(entry)}
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
  );
}
