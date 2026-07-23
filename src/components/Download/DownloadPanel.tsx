import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useDownloadQueue } from '@/store/useDownloadQueue';
import { listen } from '@tauri-apps/api/event';
import { cancelDownload, getDownloadStatus, installVersion } from '@/services/download';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Download, X, Loader2, Clock, Play,
} from 'lucide-react';
import type { DownloadProgress as DownloadProgressType } from '@/types';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

export function DownloadPanel() {
  const activeDownloads = useAppStore((state) => state.activeDownloads);
  const clearDownload = useAppStore((state) => state.clearDownload);
  const queue = useDownloadQueue((state) => state.queue);
  const completeActive = useDownloadQueue((state) => state.completeActive);
  const removeFromQueue = useDownloadQueue((state) => state.removeFromQueue);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let pollInterval: ReturnType<typeof setInterval> | undefined;
    let destroyed = false;
    let polling = false;

    (async () => {
      try {
        // Clean up stale entries from the store on mount
        const store = useAppStore.getState();
        const currentDownloads = store.activeDownloads;
        for (const [build, info] of currentDownloads.entries()) {
          if (info.status === 'downloading') {
            try {
              const status = await getDownloadStatus(info.id);
              if (status && !['downloading', 'pending', 'extracting'].includes(status.status)) {
                store.clearDownload(build);
              }
            } catch (e) {
              console.debug('Download status check failed (keeping entry):', e);
            }
          }
        }

        const cleanup = await listen<DownloadProgressType>('download-progress', (event) => {
          if (destroyed) return;
          const p = event.payload;
          const store = useAppStore.getState();
          store.updateDownloadProgress(p.build_number, p.percentage, p.download_id, p.status);
          if (TERMINAL_STATUSES.has(p.status)) {
            store.clearDownload(p.build_number);
            const next = completeActive();
            if (next) startQueuedDownload(next);
          }
        });
        if (!destroyed) {
          unlisten = cleanup;

          pollInterval = setInterval(async () => {
            if (destroyed || polling) return;
            polling = true;
            try {
              const store = useAppStore.getState();
              for (const [build, info] of store.activeDownloads.entries()) {
                if (destroyed) return;
                if (info.status === 'downloading') {
                  try {
                    const status = await getDownloadStatus(info.id);
                    if (status) {
                      const dbStatus = status.status;
                        if (dbStatus === 'completed' || dbStatus === 'failed' || dbStatus === 'cancelled') {
                        store.clearDownload(build);
                        const next = completeActive();
                        if (next) startQueuedDownload(next);
                      }
                      if (dbStatus === 'extracting') {
                        store.updateDownloadProgress(build, 100, info.id, 'extracting');
                      }
                    }
                  } catch (e) {
                    console.debug('Polling status check failed (keeping entry):', e);
                  }
                }
              }
            } finally {
              polling = false;
            }
          }, 10000);
        } else {
          cleanup();
        }
      } catch (err) {
        console.error('Failed to setup download listener:', err);
      }
    })();

    return () => {
      destroyed = true;
      if (pollInterval) clearInterval(pollInterval);
      if (unlisten) unlisten();
    };
  }, []);

  // Shared function to start the next queued download
  const startQueuedDownload = async (next: { build: any; addedAt: number }) => {
    setTimeout(async () => {
      try {
        const downloadId = await installVersion(next.build);
        const store = useAppStore.getState();
        store.updateDownloadProgress(next.build.build_number, 0, downloadId, 'downloading');
        useDownloadQueue.setState({ active: next.build });
      } catch (err) {
        console.error('Failed to start queued download:', err);
        // Direct queue access — doesn't depend on active being set
        const queueState = useDownloadQueue.getState();
        if (queueState.queue.length > 0) {
          const retryNext = { build: queueState.queue[0].build, addedAt: queueState.queue[0].addedAt };
          useDownloadQueue.setState({ queue: queueState.queue.slice(1) });
          await startQueuedDownload(retryNext);
        }
      }
    }, 1000);
  };

  const handleCancel = async (build: string, downloadId: number) => {
    try {
      await cancelDownload(downloadId);
    } catch (err) {
      console.error('Failed to cancel download:', err);
    } finally {
      clearDownload(build);
      const next = completeActive();
      if (next) {
        startQueuedDownload(next);
      }
    }
  };

  // Status label helper
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'extracting': return 'Extracting...';
      case 'downloading': return 'Downloading...';
      case 'pending': return 'Waiting...';
      default: return status;
    }
  };

  // Active downloads
  const activeEntries = Array.from(activeDownloads.entries());

  // If nothing active and nothing queued, hide
  if (activeEntries.length === 0 && queue.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 w-80 z-50 max-h-[80vh] overflow-y-auto">
      <Card className="border-border/50 bg-card/95 backdrop-blur shadow-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Download className="h-4 w-4" />
            Downloads {activeEntries.length > 0 || queue.length > 0 ? `(${activeEntries.length + queue.length})` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Active downloads */}
          {activeEntries.map(([build, info]) => (
            <div key={build} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-medium">{build}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{Math.round(info.progress)}%</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleCancel(build, info.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <Progress value={info.progress} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  {info.status === 'extracting' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3" />
                  )}
                  <span>{getStatusLabel(info.status)}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Queued downloads */}
          {queue.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/30">
              <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Queued ({queue.length})
              </div>
              {queue.map((item, idx) => (
                <div key={`${item.build.build_number}-${item.build.backend}`} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Play className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono text-xs">{item.build.build_number}</span>
                    <span className="text-xs text-muted-foreground">({item.build.backend})</span>
                    <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => removeFromQueue(item.build.build_number, item.build.backend)}
                  >
                    <X className="h-2.5 w-2.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
