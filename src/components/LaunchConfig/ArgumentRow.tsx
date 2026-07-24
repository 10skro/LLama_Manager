import { GripVertical, ChevronUp, ChevronDown, X, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import type { LlamaCppArg } from '@/data/llamaCppArgs';
import type { LaunchConfigArg } from '@/types';

interface ArgumentRowProps {
  arg: LlamaCppArg;
  configArg: LaunchConfigArg;
  index: number;
  total: number;
  onChange: (value: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

export function ArgumentRow({
  arg,
  configArg,
  index,
  total,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: ArgumentRowProps) {
  const isBoolean = arg.type === 'boolean';
  const isEnum = arg.type === 'enum';
  const isEmptyValue = !isBoolean && !configArg.value;

  return (
    <div className={`flex items-center gap-2 group ${isEmptyValue ? 'border border-yellow/40 rounded-md px-2 py-1' : ''}`}>
      {isEmptyValue && (
        <AlertTriangle className="h-3.5 w-3.5 text-yellow shrink-0" />
      )}
      {/* Grip + Flag */}
      <div className="flex items-center gap-1.5 shrink-0">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        <Badge variant="outline" className="font-mono text-xs shrink-0">
          {arg.flag}
        </Badge>
        {arg.longFlag && (
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
            ({arg.longFlag})
          </span>
        )}
      </div>

      {/* Value Input */}
      <div className="flex-1 min-w-0">
        {isBoolean ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between font-mono text-xs"
              >
                {configArg.value === 'true' ? 'Enabled' : 'Disabled'}
                <ChevronDown className="h-3 w-3 ml-2 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-32">
              <DropdownMenuItem onClick={() => onChange('true')}>Enabled</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onChange('false')}>Disabled</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : isEnum ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between font-mono text-xs"
              >
                {configArg.value || arg.defaultValue || 'Select...'}
                <ChevronDown className="h-3 w-3 ml-2 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {arg.enumOptions?.map((option) => (
                <DropdownMenuItem key={option} onClick={() => onChange(option)}>
                  {option}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Input
            type={arg.type === 'number' ? 'number' : 'text'}
            value={configArg.value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={arg.defaultValue || 'Value...'}
            className="h-8 font-mono text-xs bg-background/50"
          />
        )}
      </div>

      {/* Reorder + Remove */}
      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onMoveUp}
          disabled={index === 0}
          title="Move up"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onMoveDown}
          disabled={index === total - 1}
          title="Move down"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-red hover:text-red/80 hover:bg-red/10"
          onClick={onRemove}
          title="Remove argument"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
