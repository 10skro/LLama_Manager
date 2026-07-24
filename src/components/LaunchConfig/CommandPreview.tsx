import { useState } from 'react';
import { Clipboard, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildLaunchCommand } from '@/utils/buildLaunchCommand';
import type { LaunchConfigArg } from '@/types';

interface CommandPreviewProps {
  exePath: string;
  modelPath: string;
  args: LaunchConfigArg[];
  shellType: 'cmd' | 'powershell';
}

export function CommandPreview({ exePath, modelPath, args, shellType }: CommandPreviewProps) {
  const [copied, setCopied] = useState(false);

  const command = buildLaunchCommand(exePath, modelPath, args, shellType);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.warn('Failed to copy command to clipboard');
    }
  };

  return (
    <div className="relative">
      <pre className="bg-background/50 border border-border/50 rounded-md p-3 text-xs font-mono text-foreground overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
        {command}
      </pre>
      <Button
        variant="outline"
        size="sm"
        className="absolute top-2 right-2 h-7 gap-1.5 text-xs"
        onClick={handleCopy}
      >
        {copied ? (
          <ClipboardCheck className="h-3.5 w-3.5 text-green" />
        ) : (
          <Clipboard className="h-3.5 w-3.5" />
        )}
        {copied ? 'Copied!' : 'Copy'}
      </Button>
    </div>
  );
}
