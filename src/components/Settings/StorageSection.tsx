import { HardDrive, FolderOpen, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { AppSettings } from '@/types';

interface StorageSectionProps {
  settings: AppSettings | null;
}

/**
 * Storage path settings section — currently WIP/disabled.
 */
export function StorageSection({ settings }: StorageSectionProps) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Storage
          <Badge
            variant="outline"
            className="ml-auto text-yellow border-yellow/30 bg-yellow/10 text-xs"
          >
            WIP
          </Badge>
        </CardTitle>
        <CardDescription>Manage where llama.cpp versions are stored.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            Storage Path
            <Badge variant="outline" className="text-yellow border-yellow/30 bg-yellow/10 text-xs">
              WIP
            </Badge>
          </Label>
          <div className="flex gap-2">
            <Input
              value={settings?.storage_path || ''}
              placeholder="Default: %LOCALAPPDATA%\llama-manager"
              className="bg-background/50 font-mono text-sm"
              disabled
            />
            <Button variant="outline" size="icon" title="Browse for folder (coming soon)" disabled>
              <FolderOpen className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" title="Apply typed path (coming soon)" disabled>
              <Save className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
