import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { ChangelogRenderer } from '@/components/shared/ChangelogRenderer';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { useServerCheck } from '@/hooks/useServerCheck';
import { ServerRunningWarningDialog } from '@/components/shared/ServerRunningWarningDialog';

interface UpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpdateModal({ open, onOpenChange }: UpdateModalProps) {
  const { updateInfo, isInstalling, installUpdate } = useAppUpdate();
  const { showWarning, setShowWarning, stoppingServers, shouldShowWarning, killAllServers } =
    useServerCheck();

  const handleInstall = async () => {
    const warning = await shouldShowWarning();
    if (warning) return;

    // Changelog is persisted by the backend in install_app_update (eliminates race condition)
    await installUpdate(updateInfo.version ?? undefined, updateInfo.body ?? undefined);
  };

  const handleConfirmWithServers = async () => {
    await killAllServers();
    // Changelog is persisted by the backend in install_app_update (eliminates race condition)
    await installUpdate(updateInfo.version ?? undefined, updateInfo.body ?? undefined);
  };

  return (
    <>
      {/* Main update dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md" onCloseAutoFocus={() => {}}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-peach" />
              Update Available
            </DialogTitle>
            <DialogDescription>
              Version <strong>{updateInfo.version}</strong>
              {updateInfo.date && ` — ${updateInfo.date}`}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-60 overflow-y-auto pr-1">
            <ChangelogRenderer body={updateInfo.body} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Later
            </Button>
            <Button onClick={handleInstall} disabled={isInstalling || stoppingServers}>
              {stoppingServers ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Stopping servers...
                </>
              ) : isInstalling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Install & Restart
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warning dialog when servers are running */}
      <ServerRunningWarningDialog
        open={showWarning}
        onOpenChange={setShowWarning}
        onConfirm={handleConfirmWithServers}
      />
    </>
  );
}
