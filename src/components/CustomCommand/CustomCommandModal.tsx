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
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            {editingCommand ? 'Edit Custom Command' : 'Create Custom Command'}
          </DialogTitle>
          <DialogDescription>
            {editingCommand ? 'Modify an existing custom command.' : 'Write a custom command manually. This command can be copied and executed in your terminal.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="cc-name">Name</Label>
            <Input
              id="cc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My custom command"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cc-description">Description (optional)</Label>
            <Input
              id="cc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this command does..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cc-command">Command</Label>
            <Textarea
              id="cc-command"
              value={command}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCommand(e.target.value)}
              placeholder="llama-server.exe -m path\to\model.gguf -c 2048 --threads 8"
              className="font-mono text-sm min-h-[120px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Command
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
