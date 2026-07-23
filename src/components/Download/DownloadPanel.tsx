import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { listen } from '@tauri-apps/api/event';
import { cancelDownload } from '@/services/download';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Download, X, Loader2,
} from 'lucide-react';
import type { DownloadProgress as DownloadProgressType } from '@/types';



// Helper to parse composite key "build_number|backend"
function parseDownloadKey(key: string): { buildNumber: string; backend: string } {
  const idx = key.indexOf('|');
  if (idx < 0) return { buildNumber: key, backend: '' };
  return { buildNumber: key.slice(0, idx), backend: key.slice(idx + 1) };
}

export function DownloadPanel() {
  const activeDownloads = useAppStore((state) => state.activeDownloads);
  const updateDownloadProgress = useAppStore((state) => state.updateDownloadProgress);
  const clearDownload = useAppStore((state) => state.clearDownload);
  const queryClient = useQueryClient();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let destroyed = false;

    (async () => {
      try {
        const cleanup = await listen<DownloadProgressType>('download-progress', (event) => {
          if (destroyed) return;
          const p = event.payload;
          const store = useAppStore.getState();

          // Strategy 1: Match by download_id (exact match)
          let matchedBuildNumber = '';
          let matchedBackend = '';
          for (const [key, info] of store.activeDownloads.entries()) {
            if (info.id === p.download_id) {
              const parsed = parseDownloadKey(key);
              matchedBuildNumber = parsed.buildNumber;
              matchedBackend = parsed.backend;
              break;
            }
          }

          // Strategy 2: Fallback — find first entry with matching build_number (ignoring download_id)
          if (!matchedBuildNumber) {
            for (const [key, _info] of store.activeDownloads.entries()) {
              const parsed = parseDownloadKey(key);
              if (parsed.buildNumber === p.build_number) {
                matchedBuildNumber = parsed.buildNumber;
                matchedBackend = parsed.backend;
                // Update the download_id and progress in a single call
                store.updateDownloadProgress(matchedBuildNumber, matchedBackend, p.percentage, p.download_id, p.status);
                break;
              }
            }
          }

          if (matchedBuildNumber) {
            store.updateDownloadProgress(matchedBuildNumber, matchedBackend, p.percentage, p.download_id, p.status);
          }

          const isTerminal = ['completed', 'failed', 'cancelled'].includes(p.status);
          if (isTerminal) {
            // Clean up: find and clear the entry matching this download
            // Try by download_id first
            let cleared = false;
            for (const [key, info] of store.activeDownloads.entries()) {
              if (info.id === p.download_id) {
                const parsed = parseDownloadKey(key);
                store.clearDownload(parsed.buildNumber, parsed.backend);
                cleared = true;
                break;
              }
            }
            // Fallback: find by build_number
            if (!cleared) {
              for (const [key, _info] of store.activeDownloads.entries()) {
                const parsed = parseDownloadKey(key);
                if (parsed.buildNumber === p.build_number) {
                  store.clearDownload(parsed.buildNumber, parsed.backend);
                  break;
                }
              }
            }
            queryClient.invalidateQueries({ queryKey: ['installed-versions'] });
          }
        });
        if (!destroyed) unlisten = cleanup;
      } catch (err) {
        console.error('Failed to setup download listener:', err);
      }
    })();

    return () => {
      destroyed = true;
      if (unlisten) unlisten();
    };
  }, [queryClient]);

  const handleCancel = async (buildNumber: string, backend: string, downloadId: number) => {
    try {
      await cancelDownload(downloadId);
    } catch (err) {
      console.error('Failed to cancel download:', err);
    } finally {
      updateDownloadProgress(buildNumber, backend, 0, downloadId, 'cancelled');
      // Defensive: clear from activeDownloads in case the backend does not emit
      // a terminal download-progress event for cancellations.
      clearDownload(buildNumber, backend);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'downloaded': return 'Download complete...';
      case 'extracting': return 'Extracting...';
      case 'downloading': return 'Downloading...';
      case 'pending': return 'Waiting...';
      case 'cancelled': return 'Cancelled';
      case 'failed': return 'Failed';
      case 'completed': return 'Completed';
      default: return status;
    }
  };

  const activeEntries = Array.from(activeDownloads.entries());

  if (activeEntries.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 w-80 z-50 max-h-[80vh] overflow-y-auto">
      <Card className="border-border/50 bg-card/95 backdrop-blur shadow-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Download className="h-4 w-4" />
            Downloads ({activeEntries.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeEntries.map(([key, info]) => {
            const { buildNumber, backend } = parseDownloadKey(key);
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{buildNumber}</span>
                    <span className="text-xs text-muted-foreground">({backend})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{Math.round(info.progress)}%</span>
                    {info.status === 'downloading' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleCancel(buildNumber, backend, info.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <Progress value={info.progress} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    {info.status === 'extracting' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : info.status === 'cancelled' || info.status === 'failed' ? (
                      <X className="h-3 w-3" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                    <span>{getStatusLabel(info.status)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
