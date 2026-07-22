import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { listen } from '@tauri-apps/api/event';
import { cancelDownload, getDownloadStatus } from '@/services/download';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Download, X, Loader2,
} from 'lucide-react';
import type { DownloadProgress as DownloadProgressType } from '@/types';

export function DownloadPanel() {
  const activeDownloads = useAppStore((state) => state.activeDownloads);
  const clearDownload = useAppStore((state) => state.clearDownload);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let pollInterval: ReturnType<typeof setInterval> | undefined;
    let destroyed = false;
    let polling = false;

    (async () => {
      try {
        // Fix 2: Clean up stale entries from the store on mount
        const store = useAppStore.getState();
        const currentDownloads = store.activeDownloads;
        for (const [build, info] of currentDownloads.entries()) {
          if (info.status === 'downloading') {
            try {
              const status = await getDownloadStatus(info.id);
              // If backend says it's not actively downloading, clear from store
              if (status && status.status !== 'downloading' && status.status !== 'pending') {
                store.clearDownload(build);
              }
            } catch {
              // If we can't check status, keep the entry (might still be downloading)
            }
          }
        }

        // Fix 1: Proper async event listener pattern with destroyed guard
        const cleanup = await listen<DownloadProgressType>('download-progress', (event) => {
          if (destroyed) return;
          const p = event.payload;
          const store = useAppStore.getState();
          store.updateDownloadProgress(p.build_number, p.percentage, p.download_id, p.status);
          if (['completed', 'failed', 'cancelled'].includes(p.status)) {
            store.clearDownload(p.build_number);
          }
        });
        if (!destroyed) {
          unlisten = cleanup;

          // Fix 3: Polling fallback - verify download status every 10 seconds
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
                    if (status && !['downloading', 'pending'].includes(status.status)) {
                      store.clearDownload(build);
                    }
                  } catch {
                    /* keep entry */
                  }
                }
              }
            } finally {
              polling = false;
            }
          }, 10000);

        } else {
          cleanup(); // Component destroyed during setup, clean up immediately
        }
      } catch (err) {
        // If listen() fails, the download event channel is unavailable.
        // The polling fallback (below) will still detect completed downloads.
        console.error('Failed to setup download listener:', err);
      }
    })();

    return () => {
      destroyed = true;
      if (pollInterval) clearInterval(pollInterval);
      if (unlisten) unlisten();
    };
  }, []);

  const handleCancel = async (build: string, downloadId: number) => {
    try {
      await cancelDownload(downloadId);
    } catch (err) {
      console.error('Failed to cancel download:', err);
    } finally {
      clearDownload(build);
    }
  };

  // Only show downloads that are actively downloading
  const activeEntries = Array.from(activeDownloads.entries()).filter(
    ([_, info]) => info.status === 'downloading',
  );

  if (activeEntries.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 w-80 z-50">
      <Card className="border-border/50 bg-card/95 backdrop-blur shadow-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Download className="h-4 w-4" />
            Active Downloads
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Downloading...</span>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
