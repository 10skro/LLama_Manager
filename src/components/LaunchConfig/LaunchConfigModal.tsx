import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useToast } from '@/hooks/use-toast';
import { useInstalledVersions } from '@/hooks/useInstalledVersions';
import { saveLaunchConfig as saveLaunchConfigApi } from '@/services/launchConfig';
import { scanModelFiles } from '@/services/launchConfig';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Plus,
  Loader2,
  Settings,
  Terminal,
  Command,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ArgumentRow } from './ArgumentRow';
import { ArgumentSearchPanel } from './ArgumentSearchPanel';
import { CommandPreview } from './CommandPreview';
import { LLAMA_CPP_ARGS } from '@/data/llamaCppArgs';
import type { LaunchConfigArg, ModelFile } from '@/types';
import type { LlamaCppArg } from '@/data/llamaCppArgs';

interface LaunchConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_EXE_NAME = 'llama-server.exe';

export function LaunchConfigModal({ open, onOpenChange }: LaunchConfigModalProps) {
  const { settings, addLaunchConfig } = useAppStore();
  const setActiveRoute = useAppStore((s) => s.setActiveRoute);
  const { toast } = useToast();
  const { data: installedVersions } = useInstalledVersions();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [shellType, setShellType] = useState<'cmd' | 'powershell'>('cmd');
  const [modelPath, setModelPath] = useState('');
  const [args, setArgs] = useState<LaunchConfigArg[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Model scanning
  const [modelFiles, setModelFiles] = useState<ModelFile[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  // Argument search panel
  const [showSearchPanel, setShowSearchPanel] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setShellType('cmd');
      setModelPath('');
      setArgs([]);
      setModelFiles([]);
      setShowModelDropdown(false);
      setShowSearchPanel(false);
    }
  }, [open]);

  // Scan model files when model_folder changes or modal opens
  const scanModels = useCallback(async () => {
    const folder = settings?.model_folder;
    if (!folder) return;

    setIsScanning(true);
    try {
      const files = await scanModelFiles(folder);
      setModelFiles(files);
    } catch (err) {
      console.error('Failed to scan model files:', err);
      toast({
        title: 'Scan failed',
        description: String(err),
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  }, [settings?.model_folder, toast]);

  useEffect(() => {
    if (open && settings?.model_folder) {
      scanModels();
    }
  }, [open, settings?.model_folder, scanModels]);

  // Find the arg definition from the catalog
  const findArgDefinition = (argKey: string): LlamaCppArg | undefined => {
    return LLAMA_CPP_ARGS.find(
      (arg) => arg.flag === argKey || arg.longFlag === argKey
    );
  };

  // Add argument from catalog
  const handleAddArg = (arg: LlamaCppArg) => {
    // Guard against duplicates (both flag and longFlag)
    const isDuplicate = args.some(
      (a) => a.argKey === arg.flag || a.argKey === arg.longFlag
    );
    if (isDuplicate) return;

    const defaultValue = arg.defaultValue || (arg.type === 'boolean' ? 'false' : '');
    setArgs((prev) => [...prev, { argKey: arg.flag, value: defaultValue }]);
    setShowSearchPanel(false);
  };

  // Remove argument
  const handleRemoveArg = (index: number) => {
    setArgs((prev) => prev.filter((_, i) => i !== index));
  };

  // Update argument value
  const handleUpdateArg = (index: number, value: string) => {
    setArgs((prev) =>
      prev.map((arg, i) => (i === index ? { ...arg, value } : arg))
    );
  };

  // Move argument up
  const handleMoveUp = (index: number) => {
    setArgs((prev) => {
      const newArgs = [...prev];
      [newArgs[index - 1], newArgs[index]] = [newArgs[index], newArgs[index - 1]];
      return newArgs;
    });
  };

  // Move argument down
  const handleMoveDown = (index: number) => {
    setArgs((prev) => {
      const newArgs = [...prev];
      [newArgs[index], newArgs[index + 1]] = [newArgs[index + 1], newArgs[index]];
      return newArgs;
    });
  };

  // Get exe path from installed versions
  const getExePath = (): string => {
    const firstVersion = installedVersions?.[0];
    if (firstVersion) {
      return `${firstVersion.install_path}\\${DEFAULT_EXE_NAME}`;
    }
    return `path\\to\\${DEFAULT_EXE_NAME}`;
  };

  // Save configuration
  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a configuration name.',
        variant: 'destructive',
      });
      return;
    }

    if (!modelPath.trim()) {
      toast({
        title: 'Model path required',
        description: 'Please select or enter a model path.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const config = await saveLaunchConfigApi({
        name: name.trim(),
        shellType,
        modelPath: modelPath.trim(),
        args,
        description: description.trim() || undefined,
      });

      addLaunchConfig(config);
      toast({
        title: 'Configuration saved',
        description: `"${config.name}" has been created.`,
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Save failed',
        description: String(err),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addedFlags = args.map((a) => a.argKey);
  const modelFolderConfigured = !!settings?.model_folder;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border/50 max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Launch Configuration
          </DialogTitle>
          <DialogDescription>
            Configure a launch command for llama.cpp server.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-4">
            {/* Config Name */}
            <div className="space-y-2">
              <Label htmlFor="config-name">Configuration Name</Label>
              <Input
                id="config-name"
                placeholder="My Server Config"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="config-desc">Description (optional)</Label>
              <Input
                id="config-desc"
                placeholder="A quick description of this configuration..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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

            {/* Model Selector */}
            <div className="space-y-2">
              <Label>Model Path</Label>
              <div className="relative">
                <Input
                  placeholder="Path to .gguf model file"
                  value={modelPath}
                  onChange={(e) => setModelPath(e.target.value)}
                  onFocus={() => modelFolderConfigured && setShowModelDropdown(true)}
                  className="bg-background/50 font-mono text-sm pr-8"
                />
                {modelFolderConfigured && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-2"
                    onClick={() => setShowModelDropdown((v) => !v)}
                  >
                    {showModelDropdown ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>

              {/* Model dropdown - rendered inline within dialog flow */}
              {showModelDropdown && modelFolderConfigured && (
                <div className="bg-card border border-border rounded-md shadow-lg max-h-48 overflow-auto">
                  {isScanning ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Scanning...
                    </div>
                  ) : modelFiles.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No .gguf files found in configured folder.
                    </div>
                  ) : (
                    modelFiles.map((file) => (
                      <button
                        key={file.path}
                        onClick={() => {
                          setModelPath(file.path);
                          setShowModelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center justify-between gap-2"
                      >
                        <span className="truncate font-mono">{file.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {(file.size / (1024 * 1024 * 1024)).toFixed(1)} GB
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {!modelFolderConfigured && (
                <p className="text-xs text-muted-foreground">
                  No model folder configured. Set it in{' '}
                  <Button
                    variant="link"
                    className="h-auto p-0 text-xs text-primary"
                    onClick={() => {
                      onOpenChange(false);
                      setActiveRoute('/settings');
                    }}
                  >
                    Settings
                  </Button>{' '}
                  or type a path manually.
                </p>
              )}
            </div>

            <Separator className="border-border/50" />

            {/* Arguments Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Arguments
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowSearchPanel(true)}
                  disabled={showSearchPanel}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Argument
                </Button>
              </div>

              {/* Argument Search Panel */}
              {showSearchPanel && (
                <div className="bg-muted/30 border border-border/50 rounded-md p-3">
                  <ArgumentSearchPanel
                    addedFlags={addedFlags}
                    onAdd={handleAddArg}
                    onClose={() => setShowSearchPanel(false)}
                  />
                </div>
              )}

              {/* Arguments List */}
              {args.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground border border-dashed border-border/50 rounded-md">
                  No arguments added. Click &quot;Add Argument&quot; to begin.
                </div>
              ) : (
                <div className="space-y-2">
                  {args.map((configArg, index) => {
                    const argDef = findArgDefinition(configArg.argKey);
                    if (!argDef) return null;

                    return (
                      <ArgumentRow
                        key={`${configArg.argKey}-${index}`}
                        arg={argDef}
                        configArg={configArg}
                        index={index}
                        total={args.length}
                        onChange={(value) => handleUpdateArg(index, value)}
                        onMoveUp={() => handleMoveUp(index)}
                        onMoveDown={() => handleMoveDown(index)}
                        onRemove={() => handleRemoveArg(index)}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <Separator className="border-border/50" />

            {/* Command Preview */}
            <div className="space-y-2">
              <Label>Command Preview</Label>
              <CommandPreview
                exePath={getExePath()}
                modelPath={modelPath || 'path\\to\\model.gguf'}
                args={args}
                shellType={shellType}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || !modelPath.trim() || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
