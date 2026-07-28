import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
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
import { useAppUpdate } from '@/hooks/useAppUpdate';
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
  const [showWarning, setShowWarning] = useState(false);
  const [stoppingServers, setStoppingServers] = useState(false);

  const handleClose = async () => {
    onOpenChange(false);
    if (dontShowAgain && settings) {
      await saveSettings({ ...settings, show_update_modal: false });
    }
  };

  const handleInstall = async () => {
    try {
      // Check if any terminal sessions are currently running
      const activeSessions = await invoke<Array<{ sessionId: string }>>('list_active_terminals');

      if (activeSessions.length > 0) {
        // Show warning dialog asking for confirmation
        setShowWarning(true);
        return;
      }
    } catch {
      // If check fails, proceed without warning (fail-safe)
    }

    // Persist changelog so it can be shown on next startup after the update
    if (settings && updateInfo.version && updateInfo.body != null) {
      await saveSettings({
        ...settings,
        pending_changelog_version: updateInfo.version,
        pending_changelog_body: updateInfo.body,
      });
    }
    await installUpdate();
  };

  const handleConfirmWithServers = async () => {
    setShowWarning(false);
    setStoppingServers(true);

    try {
      // Stop all running servers first
      await invoke('kill_all_terminals');
    } catch {
      // Even if kill fails, proceed with update (backend has safety net)
    }

    // Small delay to ensure processes are terminated
    await new Promise((resolve) => setTimeout(resolve, 500));
    setStoppingServers(false);

    // Persist changelog so it can be shown on next startup after the update
    if (settings && updateInfo.version && updateInfo.body != null) {
      await saveSettings({
        ...settings,
        pending_changelog_version: updateInfo.version,
        pending_changelog_body: updateInfo.body,
      });
    }
    await installUpdate();
  };

  // Parse changelog body: support basic markdown-like formatting
  const renderChangelog = (body: string | null) => {
    if (!body) return <p className="text-sm text-muted-foreground">No changelog available.</p>;

    return (
      <div className="space-y-2 text-sm [&>p]:text-muted-foreground">
        {body.split('\n').map((line, i) => {
          // Skip empty lines
          if (!line.trim()) return <div key={i} className="h-2" />;

          // Headers
          if (line.startsWith('## ')) {
            return <p key={i} className="font-semibold text-foreground mt-2">{line.replace('## ', '')}</p>;
          }
          if (line.startsWith('# ')) {
            return <p key={i} className="font-bold text-foreground mt-2">{line.replace('# ', '')}</p>;
          }

          // Bullet points
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <p key={i} className="flex gap-2">
                <span className="text-muted-foreground mt-0.5">•</span>
                <span className="text-muted-foreground">{line.replace(/^[-*]\s/, '')}</span>
              </p>
            );
          }

          return <p key={i} className="text-muted-foreground">{line}</p>;
        })}
      </div>
    );
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
            {renderChangelog(updateInfo.body)}
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
