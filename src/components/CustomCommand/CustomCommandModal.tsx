import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useToast } from '@/hooks/use-toast';
import { saveCustomCommand as saveCustomCommandApi } from '@/services/customCommand';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Terminal, Loader2 } from 'lucide-react';
import type { CustomCommand } from '@/types';

interface EditingCommand {
  id: string;
  name: string;
  command: string;
  description?: string;
  createdAt: string;
}

interface CustomCommandModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCommand?: EditingCommand | null;
}

export function CustomCommandModal({ open, onOpenChange, editingCommand }: CustomCommandModalProps) {
  const { addCustomCommand, updateCustomCommand } = useAppStore();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [command, setCommand] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      if (editingCommand) {
        setName(editingCommand.name);
        setDescription(editingCommand.description || '');
        setCommand(editingCommand.command);
      } else {
        setName('');
        setDescription('');
        setCommand('');
      }
    }
  }, [open, editingCommand]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Name required', description: 'Please enter a command name.', variant: 'destructive' });
      return;
    }
    if (!command.trim()) {
      toast({ title: 'Command required', description: 'Please enter a command.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const input: any = {
        name: name.trim(),
        command: command.trim(),
        description: description.trim() || undefined,
      };
      if (editingCommand) {
        input.id = editingCommand.id;
        input.createdAt = editingCommand.createdAt;
      }

      const config = await saveCustomCommandApi(input);

      if (editingCommand) {
        updateCustomCommand(config as CustomCommand);
        toast({ title: 'Command updated', description: `"${config.name}" has been updated.` });
      } else {
        addCustomCommand(config as CustomCommand);
        toast({ title: 'Command saved', description: `"${config.name}" has been saved.` });
      }

      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Save failed', description: String(err), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border/50 sm:max-w-lg">
        <DialogHeader className="gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Terminal className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <DialogTitle className="text-lg">
                {editingCommand ? 'Edit Custom Command' : 'Create Custom Command'}
              </DialogTitle>
              <DialogDescription className="text-sm mt-0.5">
                {editingCommand
                  ? 'Modify an existing custom command.'
                  : 'Define a startup command to launch llama.cpp servers.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {/* Info Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border/50" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Details</span>
              <div className="h-px flex-1 bg-border/50" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="cc-name" className="text-sm font-medium">Name</Label>
                <span className="text-[10px] font-semibold text-destructive">REQUIRED</span>
              </div>
              <Input
                id="cc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My Model 7B"
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="cc-description" className="text-sm font-medium">Description</Label>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">optional</span>
              </div>
              <Input
                id="cc-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this command is for..."
                className="bg-background"
              />
            </div>
          </div>

          {/* Command Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border/50" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Command</span>
              <div className="h-px flex-1 bg-border/50" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="cc-command" className="text-sm font-medium">Startup command</Label>
                <span className="text-[10px] font-semibold text-destructive">REQUIRED</span>
              </div>
              <div className="relative">
                <div className="absolute left-3 top-3 z-10">
                  <Terminal className="h-4 w-4 text-muted-foreground/60" />
                </div>
                <Textarea
                  id="cc-command"
                  value={command}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCommand(e.target.value)}
                  placeholder="llama-server.exe -m path\to\model.gguf&#10;  -c 2048 --threads 8 --ctx-size 4096"
                  className="font-mono text-sm min-h-[200px] pl-9 bg-muted/30 border-border/80 focus-visible:border-primary/50 rounded-lg resize-none"
                />
              </div>

              {/* Tips */}
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  ℹ️ You don't need to write <code className="font-mono bg-muted/50 px-1 py-0.5 rounded">llama-server.exe</code> — the app handles the executable and full launch path automatically when the config is run from a card.
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <span className="inline-flex items-center rounded-md bg-muted/50 px-1.5 py-0.5 text-[11px] font-mono mt-0.5">-m</span>
                    <span className="text-xs text-muted-foreground">
                      Model path — <span className="text-foreground font-medium">optional</span>, can be overridden per card
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="inline-flex items-center rounded-md bg-muted/50 px-1.5 py-0.5 text-[11px] font-mono mt-0.5">--mmproj</span>
                    <span className="text-xs text-muted-foreground">
                      Multimodal projector — <span className="text-foreground font-medium">optional</span>, can be overridden per card
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {editingCommand ? 'Save Changes' : 'Create Config'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
