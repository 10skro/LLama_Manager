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

interface CustomCommandModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomCommandModal({ open, onOpenChange }: CustomCommandModalProps) {
  const { addCustomCommand } = useAppStore();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [command, setCommand] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setCommand('');
    }
  }, [open]);

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
      const config = await saveCustomCommandApi({
        name: name.trim(),
        command: command.trim(),
        description: description.trim() || undefined,
      });
      addCustomCommand(config);
      toast({ title: 'Command saved', description: `"${config.name}" has been created.` });
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
            Create Custom Command
          </DialogTitle>
          <DialogDescription>
            Write a custom command manually. This command can be copied and executed in your terminal.
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
