import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, AlertTriangle } from 'lucide-react';
import { ChangelogRenderer } from '@/components/ChangelogRenderer';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { useServerCheck } from '@/hooks/useServerCheck';
import { useAppStore } from '@/store/useAppStore';
import { saveSettings } from '@/services/settings';

interface UpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpdateModal({ open, onOpenChange }: UpdateModalProps) {
  const { updateInfo, isInstalling, installUpdate } = useAppUpdate();
  const { settings } = useAppStore();
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const { showWarning, setShowWarning, stoppingServers, shouldShowWarning, killAllServers } = useServerCheck();

  const handleClose = async () => {
    onOpenChange(false);
    if (dontShowAgain && settings) {
      await saveSettings({ ...settings, show_update_modal: false });
    }
  };

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
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md" onCloseAutoFocus={() => {}}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-peach" />
              Mise à jour disponible
            </DialogTitle>
            <DialogDescription>
              Version <strong>{updateInfo.version}</strong>
              {updateInfo.date && ` — ${updateInfo.date}`}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-60 overflow-y-auto pr-1">
            <ChangelogRenderer body={updateInfo.body} />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="dontShowAgain"
              checked={dontShowAgain}
              onChange={e => setDontShowAgain(e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="dontShowAgain" className="text-xs text-muted-foreground cursor-pointer select-none">
              Ne plus afficher au démarrage
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose()}>
              Plus tard
            </Button>
            <Button onClick={handleInstall} disabled={isInstalling || stoppingServers}>
              {stoppingServers ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Arrêt des serveurs en cours...
                </>
              ) : isInstalling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Installation...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Installer et redémarrer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warning dialog when servers are running */}
      <Dialog open={showWarning} onOpenChange={setShowWarning}>
        <DialogContent className="max-w-md" onCloseAutoFocus={() => {}}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Serveurs en cours d'exécution
            </DialogTitle>
            <DialogDescription>
              Des serveurs sont actuellement actifs et seront arrêtés avant l'installation de la mise à jour. Voulez-vous continuer ?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWarning(false)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmWithServers}>
              Continuer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
