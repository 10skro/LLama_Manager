import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Loader2, Settings2, Filter } from 'lucide-react';
import {
  deleteVersionOverride,
  saveVersionOverride,
  scanMmprojFiles,
} from '@/services/versionOverride';
import { scanModelFiles } from '@/services/modelFiles';
import type { ModelFile, VersionOverride } from '@/types';
import type { FileExtensionFilter } from '@/services/modelFiles';

const EXTENSION_FILTERS: { value: FileExtensionFilter; label: string; ext: string }[] = [
  { value: 'all', label: 'All', ext: '*' },
  { value: 'gguf', label: '.gguf', ext: 'gguf' },
  { value: 'safetensors', label: '.safetensors', ext: 'safetensors' },
];

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
  const [modelFilter, setModelFilter] = useState<FileExtensionFilter>('all');
  const [mmprojFilter, setMmprojFilter] = useState<FileExtensionFilter>('all');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Scan files when dialog opens or filter changes
  const scanFiles = useCallback(async (
    folder: string | undefined,
    filter: FileExtensionFilter,
    setter: React.Dispatch<React.SetStateAction<ModelFile[]>>,
    label: string,
  ) => {
    if (!folder) {
      setter([]);
      return;
    }
    try {
      const files = await (label === 'model'
        ? scanModelFiles(folder, filter)
        : scanMmprojFiles(folder, filter)
      );
      setter(files);
    } catch (e) {
      console.error(`[OverrideDialog] ${label} scan error:`, e);
      setter([]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setScanning(true);
    let mounted = true;

    Promise.all([
      scanFiles(modelFolder, modelFilter, setModelFiles, 'model'),
      scanFiles(mmprojFolder, mmprojFilter, setMmprojFiles, 'mmproj'),
    ]).finally(() => {
      if (mounted) setScanning(false);
    });

    return () => { mounted = false; };
  }, [open, modelFolder, mmprojFolder, modelFilter, mmprojFilter, scanFiles]);

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

  // Wrap onOpenChange to clean up Select state before dialog closes
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedModel('');
      setSelectedMmproj('');
      setModelFiles([]);
      setMmprojFiles([]);
    }
    onOpenChange(nextOpen);
  }, [onOpenChange]);

  // Extract file extension for badge display
  const getFileExt = useCallback((name: string) => {
    const match = name.match(/\.[a-z0-9]+$/i);
    return match ? match[0].replace('.', '').toLowerCase() : '';
  }, []);

  const extBadgeColor = useMemo(() => (ext: string) => {
    switch (ext) {
      case 'gguf': return 'bg-violet-500/20 text-violet-300 border-violet-500/30';
      case 'safetensors': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default: return 'bg-secondary text-muted-foreground border-border';
    }
  }, []);

  // File selector with filter
  const FileSelector = ({
    label,
    folder,
    files,
    value,
    onChange,
    filter,
    onFilterChange,
    placeholder,
    noFolderMessage,
  }: {
    label: string;
    folder: string | undefined;
    files: ModelFile[];
    value: string;
    onChange: (v: string) => void;
    filter: FileExtensionFilter;
    onFilterChange: (f: FileExtensionFilter) => void;
    placeholder: string;
    noFolderMessage: string;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {folder && (
          <div className="flex items-center gap-1 bg-card border border-border/50 rounded-lg p-0.5">
            <Filter className="h-3 w-3 text-muted-foreground mr-1 ml-1" />
            {EXTENSION_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={filter === f.value ? 'secondary' : 'outline'}
                size="sm"
                className={`text-xs h-6 px-2.5 ${filter === f.value ? 'border-primary/50 font-semibold' : 'border-border/40 text-muted-foreground'}`}
                onClick={() => onFilterChange(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        )}
      </div>
      <Select
        value={value}
        onValueChange={onChange}
        disabled={!folder || scanning}
      >
        <SelectTrigger className="w-full min-w-0 max-w-full overflow-hidden [&>span]:block [&>span]:overflow-hidden [&>span]:whitespace-nowrap [&>span]:truncate">
          <SelectValue placeholder={folder ? placeholder : noFolderMessage} />
        </SelectTrigger>
        <SelectContent className="max-w-[calc(var(--radix-select-trigger-width)-1px)] min-w-[8rem] [&_[data-highlighted]]:bg-foreground/5 [&_[data-highlighted]]:text-foreground [&_[data-state=checked]]:bg-foreground/5">
          {scanning
            ? <SelectItem value="__loading" disabled className="hover:bg-foreground/5 focus:bg-foreground/5">Loading...</SelectItem>
            : files.length === 0
              ? <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                  No files found{filter !== 'all' ? ` (${filter})` : ''}
                </div>
              : files.map((file) => (
                  <SelectItem key={file.path} value={file.path} className="hover:bg-foreground/5 focus:bg-foreground/5 text-foreground">
                    <div className="flex items-center gap-2 max-w-full">
                      <span className="truncate flex-1" title={file.path}>{file.name}</span>
                      <Badge variant="outline" className={`text-[10px] h-5 px-1.5 shrink-0 ${extBadgeColor(getFileExt(file.name))}`}>
                        {getFileExt(file.name)}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
        </SelectContent>
      </Select>
      {!folder && (
        <p className="text-xs text-muted-foreground">
          {noFolderMessage}
        </p>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden grid-cols-1">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Model Override
          </DialogTitle>
          <DialogDescription>
            Override the model and mmproj paths for <strong>{versionName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {scanning && modelFiles.length === 0 && mmprojFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Scanning files...</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <FileSelector
              label="Model Path"
              folder={modelFolder}
              files={modelFiles}
              value={selectedModel}
              onChange={setSelectedModel}
              filter={modelFilter}
              onFilterChange={setModelFilter}
              placeholder="Select a model file..."
              noFolderMessage="Configure a model folder in Settings to enable model selection."
            />
            <FileSelector
              label="Mmproj Path"
              folder={mmprojFolder}
              files={mmprojFiles}
              value={selectedMmproj}
              onChange={setSelectedMmproj}
              filter={mmprojFilter}
              onFilterChange={setMmprojFilter}
              placeholder="Select a mmproj file..."
              noFolderMessage="Configure a mmproj folder in Settings to enable mmproj selection."
            />
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
