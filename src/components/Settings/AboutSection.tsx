import { Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AboutSectionProps {
  appVersion: string;
}

/**
 * About section — app version and description.
 */
export function AboutSection({ appVersion }: AboutSectionProps) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          About
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Llama Manager</strong>{' '}
          {appVersion ? `v${appVersion}` : '...'}
        </p>
        <p className="text-sm text-muted-foreground">
          A modern Windows application for managing llama.cpp builds.
        </p>
        <p className="text-sm text-muted-foreground">Built with Tauri, React, and Rust.</p>
      </CardContent>
    </Card>
  );
}
