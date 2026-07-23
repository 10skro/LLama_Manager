import { useEffect, useCallback } from 'react';
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

// Helper to parse composite key "build_number|backend"
function parseDownloadKey(key: string): { buildNumber: string; backend: string } {
  const idx = key.indexOf('|');
  if (idx < 0) return { buildNumber: key, backend: '' };
  return { buildNumber: key.slice(0, idx), backend: key.slice(idx + 1) };
}

export function DownloadPanel() {
  const activeDownloads = useAppStore((state) => state.activeDownloads);
  const updateDownloadProgress = useAppStore((state) => state.updateDownloadProgress);
  const clearDownloadByBuildNumber = useAppStore((state) => state.clearDownloadByBuildNumber);
  const queue = useDownloadQueue((state) => state.queue);
  const completeActive = useDownloadQueue((state) => state.completeActive);
  const removeFromQueue = useDownloadQueue((state) => state.removeFromQueue);

  // FIX: Wrap in useCallback to prevent stale closure issues
  const startQueuedDownload = useCallback(async (next: { build: any; addedAt: number }) => {
    setTimeout(async () => {
      try {
        // FIX: Set active BEFORE starting download to eliminate race condition
        useDownloadQueue.setState({ active: next.build });
        const downloadId = await installVersion(next.build);
        // Register in activeDownloads immediately
        const store = useAppStore.getState();
        store.updateDownloadProgress(next.build.build_number, next.build.backend, 0, downloadId, 'downloading');
      } catch (err) {
        console.error('Failed to start queued download:', err);
        // Reset active since it failed
        useDownloadQueue.setState({ active: null });
        // Try next in queue
        const queueState = useDownloadQueue.getState();
        if (queueState.queue.length > 0) {
          const retryNext = { build: queueState.queue[0].build, addedAt: queueState.queue[0].addedAt };
          useDownloadQueue.setState({ queue: queueState.queue.slice(1) });
          await startQueuedDownload(retryNext);
        }
      }
    }, 1000);
  }, []);

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
        for (const [key, info] of currentDownloads.entries()) {
          if (info.status === 'downloading') {
            try {
              const status = await getDownloadStatus(info.id);
              if (status && !['downloading', 'pending', 'extracting'].includes(status.status)) {
                const { buildNumber, backend } = parseDownloadKey(key);
                store.clearDownload(buildNumber, backend);
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

          // FIX: Find backend from activeDownloads, fallback to queue.active
          let backend = '';
          for (const [key] of store.activeDownloads.entries()) {
            const { buildNumber } = parseDownloadKey(key);
            if (buildNumber === p.build_number) {
              const parsed = parseDownloadKey(key);
              backend = parsed.backend;
              break;
            }
          }
          // Fallback: check queue's active build
          if (!backend) {
            const queueState = useDownloadQueue.getState();
            if (queueState.active?.build_number === p.build_number) {
              backend = queueState.active.backend;
            }
          }

          if (backend) {
            store.updateDownloadProgress(p.build_number, backend, p.percentage, p.download_id, p.status);
          }

          if (TERMINAL_STATUSES.has(p.status)) {
            clearDownloadByBuildNumber(p.build_number);
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
              for (const [key, info] of store.activeDownloads.entries()) {
                if (destroyed) return;
                if (info.status === 'downloading') {
                  try {
                    const status = await getDownloadStatus(info.id);
                    if (status) {
                      const dbStatus = status.status;
                      if (dbStatus === 'completed' || dbStatus === 'failed' || dbStatus === 'cancelled') {
                        const { buildNumber, backend } = parseDownloadKey(key);
                        store.clearDownload(buildNumber, backend);
                        const next = completeActive();
                        if (next) startQueuedDownload(next);
                      }
                      if (dbStatus === 'extracting') {
                        const { buildNumber, backend } = parseDownloadKey(key);
                        store.updateDownloadProgress(buildNumber, backend, 100, info.id, 'extracting');
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
  }, [clearDownloadByBuildNumber, completeActive, startQueuedDownload]);

  // FIX: Cancel updates status to 'cancelled' instead of clearing immediately
  // This keeps the entry visible until the backend event confirms cancellation
  const handleCancelActive = async (buildNumber: string, backend: string, downloadId: number) => {
    try {
      await cancelDownload(downloadId);
    } catch (err) {
      console.error('Failed to cancel download:', err);
    } finally {
      // Update status to cancelled (keep entry visible)
      updateDownloadProgress(buildNumber, backend, 0, downloadId, 'cancelled');
      // The event listener will call clearDownloadByBuildNumber + completeActive when 'cancelled' event arrives
    }
  };

  // Cancel a queued download (just remove from queue, do not touch active download)
  const handleCancelQueued = (buildNumber: string, backend: string) => {
    removeFromQueue(buildNumber, backend);
  };

  // Status label helper
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'extracting': return 'Extracting...';
      case 'downloading': return 'Downloading...';
      case 'pending': return 'Waiting...';
      case 'cancelled': return 'Cancelled';
      case 'failed': return 'Failed';
      case 'completed': return 'Completed';
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
                        onClick={() => handleCancelActive(buildNumber, backend, info.id)}
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
                    onClick={() => handleCancelQueued(item.build.build_number, item.build.backend)}
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
