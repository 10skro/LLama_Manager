import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Settings2 } from 'lucide-react';
import {
  deleteVersionOverride,
  saveVersionOverride,
  scanMmprojFiles,
} from '@/services/versionOverride';
import { scanModelFiles } from '@/services/launchConfig';
import type { ModelFile, VersionOverride } from '@/types';

interface OverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionId: number;
  versionName: string;
  modelFolder: string | undefined;
  mmprojFolder: string | undefined;
  currentOverride: VersionOverride | null;
  onSave: (override: VersionOverride | null) => void;
}

export default function OverrideDialog({
  open,
  onOpenChange,
  versionId,
  versionName,
  modelFolder,
  mmprojFolder,
  currentOverride,
  onSave,
}: OverrideDialogProps) {
  const [modelFiles, setModelFiles] = useState<ModelFile[]>([]);
  const [mmprojFiles, setMmprojFiles] = useState<ModelFile[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedMmproj, setSelectedMmproj] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Load files when dialog opens
  useEffect(() => {
    if (!open) return;

    setScanning(true);
    const loadFiles = async () => {
      try {
        const [models, mmprojs] = await Promise.all([
          modelFolder ? scanModelFiles(modelFolder) : Promise.resolve([]),
          mmprojFolder ? scanMmprojFiles(mmprojFolder) : Promise.resolve([]),
        ]);
        setModelFiles(models);
        setMmprojFiles(mmprojs);
      } catch (e) {
        console.error('Failed to scan files:', e);
      } finally {
        setScanning(false);
      }
    };

    loadFiles();
  }, [open, modelFolder, mmprojFolder]);

  // Sync current override to local state when dialog opens
  useEffect(() => {
    if (open && currentOverride) {
      setSelectedModel(currentOverride.model_path ?? '');
      setSelectedMmproj(currentOverride.mmproj_path ?? '');
    } else if (open) {
      setSelectedModel('');
      setSelectedMmproj('');
    }
  }, [open, currentOverride]);

  const handleSave = useCallback(async () => {
    setLoading(true);
    try {
      await saveVersionOverride(versionId, selectedModel || null, selectedMmproj || null);
      onSave({
        version_id: versionId,
        model_path: selectedModel || null,
        mmproj_path: selectedMmproj || null,
      });
      onOpenChange(false);
    } catch (e) {
      console.error('Failed to save override:', e);
    } finally {
      setLoading(false);
    }
  }, [versionId, selectedModel, selectedMmproj, onSave, onOpenChange]);

  const handleReset = useCallback(async () => {
    if (!window.confirm('Are you sure you want to clear this override? This action cannot be undone.')) {
      return;
    }
    setLoading(true);
    try {
      await deleteVersionOverride(versionId);
      setSelectedModel('');
      setSelectedMmproj('');
      onSave(null);
      onOpenChange(false);
    } catch (e) {
      console.error('Failed to reset override:', e);
    } finally {
      setLoading(false);
    }
  }, [versionId, onSave, onOpenChange]);

  const hasOverride = currentOverride && (currentOverride.model_path || currentOverride.mmproj_path);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Model Override
          </DialogTitle>
          <DialogDescription>
            Override the model and mmproj paths for <strong>{versionName}</strong>.
            {' '}Overrides replace the values from the launch configuration.
          </DialogDescription>
        </DialogHeader>

        {scanning ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Scanning files...</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Model Path */}
          <div className="space-y-2">
            <Label htmlFor="model-select">Model Path (.gguf)</Label>
            <Select
              value={selectedModel}
              onValueChange={setSelectedModel}
              disabled={!modelFolder || scanning}
            >
              <SelectTrigger id="model-select">
                <SelectValue placeholder={modelFolder ? 'Select a model file...' : 'No model folder configured'} />
              </SelectTrigger>
              <SelectContent>
                {scanning
                  ? <SelectItem value="__loading" disabled>Loading...</SelectItem>
                  : modelFiles.map((file) => (
                      <SelectItem key={file.path} value={file.path}>
                        {file.name}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
            {!modelFolder && (
              <p className="text-xs text-muted-foreground">
                Configure a model folder in Settings to enable model selection.
              </p>
            )}
          </div>

          {/* Mmproj Path */}
          <div className="space-y-2">
            <Label htmlFor="mmproj-select">Mmproj Path (.mmproj)</Label>
            <Select
              value={selectedMmproj}
              onValueChange={setSelectedMmproj}
              disabled={!mmprojFolder || scanning}
            >
              <SelectTrigger id="mmproj-select">
                <SelectValue placeholder={mmprojFolder ? 'Select a mmproj file...' : 'No mmproj folder configured'} />
              </SelectTrigger>
              <SelectContent>
                {scanning
                  ? <SelectItem value="__loading" disabled>Loading...</SelectItem>
                  : mmprojFiles.map((file) => (
                      <SelectItem key={file.path} value={file.path}>
                        {file.name}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
            {!mmprojFolder && (
              <p className="text-xs text-muted-foreground">
                Configure a mmproj folder in Settings to enable mmproj selection.
              </p>
            )}
          </div>
        </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {hasOverride && (
            <Button variant="outline" onClick={handleReset} disabled={loading}>
              Reset
            </Button>
          )}
          <Button onClick={handleSave} disabled={loading || scanning}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
