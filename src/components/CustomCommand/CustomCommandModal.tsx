import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useToast } from '@/hooks/use-toast';
import { saveCustomCommand as saveCustomCommandApi } from '@/services/customCommand';
import { convertCommand, detectShellFormat } from '@/lib/commandConverter';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Terminal, Loader2, Command } from 'lucide-react';

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
  const [shellType, setShellType] = useState<'cmd' | 'powershell'>('cmd');
  const [isSaving, setIsSaving] = useState(false);

  // Detect the shell format of the entered command for display
  const detectedFormat = useMemo(() => {
    if (!command.trim()) return null;
    return detectShellFormat(command);
  }, [command]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setCommand('');
      setShellType('cmd');
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
      // Convert the command to the target shell format before saving
      const trimmedCommand = command.trim();
      const convertedCommand = convertCommand(trimmedCommand, shellType);
      const config = await saveCustomCommandApi({
        name: name.trim(),
        command: convertedCommand,
        description: description.trim() || undefined,
        shellType,
      });
      addCustomCommand(config);

      // Notify user if conversion happened
      if (convertedCommand !== trimmedCommand) {
        const shellLabel = shellType === 'cmd' ? 'CMD' : 'PowerShell';
        toast({
          title: 'Command converted',
          description: `Command was converted to ${shellLabel} format and saved.`,
        });
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

          {/* Shell Type */}
          <div className="space-y-2">
            <Label>Shell Type</Label>
            <div className="flex gap-2">
              <Button
                variant={shellType === 'cmd' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 gap-2"
                onClick={() => setShellType('cmd')}
              >
                <Command className="h-4 w-4" />
                CMD
              </Button>
              <Button
                variant={shellType === 'powershell' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 gap-2"
                onClick={() => setShellType('powershell')}
              >
                <Terminal className="h-4 w-4" />
                PowerShell
              </Button>
            </div>
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
            {detectedFormat && detectedFormat !== 'plain' && (
              <p className="text-xs text-muted-foreground">
                Detected format: {detectedFormat === 'cmd' ? 'CMD (^)' : 'PowerShell (`)'}
                {detectedFormat !== shellType && (
                  <span> — will be converted to {shellType === 'cmd' ? 'CMD' : 'PowerShell'} on save</span>
                )}
              </p>
            )}
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
