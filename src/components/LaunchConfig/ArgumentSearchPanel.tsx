import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CATEGORIES, searchArgs } from '@/data/llamaCppArgs';
import type { LlamaCppArg } from '@/data/llamaCppArgs';

interface ArgumentSearchPanelProps {
  addedFlags: string[];
  onAdd: (arg: LlamaCppArg) => void;
  onClose: () => void;
}

export function ArgumentSearchPanel({ addedFlags, onAdd, onClose }: ArgumentSearchPanelProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredArgs = useMemo(() => {
    let args = searchArgs(search);
    if (selectedCategory !== 'all') {
      args = args.filter((arg) => arg.category === selectedCategory);
    }
    return args;
  }, [search, selectedCategory]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, LlamaCppArg[]> = {};
    for (const arg of filteredArgs) {
      if (!groups[arg.category]) {
        groups[arg.category] = [];
      }
      groups[arg.category].push(arg);
    }
    return groups;
  }, [filteredArgs]);

  const isAdded = (arg: LlamaCppArg): boolean =>
    addedFlags.includes(arg.flag) ||
    (arg.longFlag != null && addedFlags.includes(arg.longFlag));

  const typeColors: Record<string, string> = {
    string: 'border-blue/50 text-blue',
    number: 'border-green/50 text-green',
    boolean: 'border-yellow/50 text-yellow',
    enum: 'border-purple/50 text-purple',
  };

  return (
    <div className="flex flex-col h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <Label className="text-sm font-medium">Add Argument</Label>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search arguments..."
          className="h-8 pl-9 text-sm bg-background/50"
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-1 mb-3 flex-wrap">
        <Button
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          className="text-xs h-6 px-2"
          onClick={() => setSelectedCategory('all')}
        >
          All
        </Button>
        {CATEGORIES.map((cat) => (
          <Button
            key={cat}
            variant={selectedCategory === cat ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-6 px-2 capitalize"
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      {/* Results */}
      <ScrollArea className="flex-1 -mx-1 px-1">
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No arguments found.
          </div>
        ) : (
          Object.entries(grouped).map(([category, args]) => (
            <div key={category} className="mb-3 last:mb-0">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
                {category}
              </div>
              <div className="space-y-0.5">
                {args.map((arg) => {
                  const added = isAdded(arg);
                  return (
                    <button
                      key={arg.flag}
                      onClick={() => !added && onAdd(arg)}
                      disabled={added}
                      className={`w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                        added
                          ? 'opacity-40 cursor-not-allowed bg-muted/30'
                          : 'hover:bg-accent cursor-pointer'
                      }`}
                    >
                      <Badge
                        variant="outline"
                        className={`font-mono text-[10px] shrink-0 ${typeColors[arg.type] || ''}`}
                      >
                        {arg.flag}
                      </Badge>
                      <span className="truncate flex-1 text-xs">
                        {arg.label}
                      </span>
                      {arg.required && (
                        <span className="text-[10px] text-red shrink-0">Required</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <Separator className="border-border/30 my-2" />
            </div>
          ))
        )}
      </ScrollArea>
    </div>
  );
}
