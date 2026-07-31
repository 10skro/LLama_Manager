import { Brain, AlertCircle, Check, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { AppSettings } from '@/types';
import { useDebouncedFolderInput } from '@/hooks/Settings/useDebouncedFolderInput';

interface ModelsSectionProps {
  settings: AppSettings | null;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

/**
 * Models section — model folder and mmproj folder configuration.
 */
export function ModelsSection({ settings, updateSetting }: ModelsSectionProps) {
  const modelInput = useDebouncedFolderInput({
    settings,
    settingKey: 'model_folder',
    updateSetting,
    label: 'Model',
    scanDescription: 'Models will be scanned from the selected folder.',
  });

  const mmprojInput = useDebouncedFolderInput({
    settings,
    settingKey: 'mmproj_folder',
    updateSetting,
    label: 'Mmproj',
    scanDescription: 'Mmproj files will be scanned from the selected folder.',
  });

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Models
        </CardTitle>
        <CardDescription>
          Configure the folder where your .gguf model files are stored.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Model Folder */}
        <div className="space-y-2">
          <Label>Model Folder</Label>
          <div className="flex gap-2">
            <Input
              value={modelInput.value}
              onChange={(e) => modelInput.handleChange(e.target.value)}
              placeholder="Select a folder containing .gguf files"
              className="bg-background/50 font-mono text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              title="Browse for model folder"
              onClick={modelInput.handleBrowse}
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            This folder is used to browse and select model files when creating launch
            configurations.
          </p>
        </div>

        <Separator className="border-border/50" />

        {/* Mmproj Folder */}
        <div className="space-y-2">
          <Label>Mmproj Folder</Label>
          <div className="flex gap-2">
            <Input
              value={mmprojInput.value}
              onChange={(e) => mmprojInput.handleChange(e.target.value)}
              placeholder="Select a folder containing .mmproj files"
              className="bg-background/50 font-mono text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              title="Browse for mmproj folder"
              onClick={mmprojInput.handleBrowse}
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            This folder is used to browse and select .mmproj files for model overrides.
          </p>
          {mmprojInput.validation === 'invalid' && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Folder does not exist or is not accessible.
            </p>
          )}
          {mmprojInput.validation === 'valid' && (
            <p className="text-xs text-green flex items-center gap-1">
              <Check className="h-3 w-3" />
              Folder exists and is accessible.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
