import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bell, Terminal, Download, Loader2, FileText } from 'lucide-react';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { useServerCheck } from '@/hooks/useServerCheck';
import { ChangelogModal } from '@/components/ChangelogModal';
import { ServerRunningWarningDialog } from '@/components/ServerRunningWarningDialog';
import { useState } from 'react';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/catalog': 'Catalog',
  '/settings': 'Settings',
};

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { newBuilds } = useAppStore();
  const { updateInfo, isInstalling, installUpdate } = useAppUpdate();
  const [changelogOpen, setChangelogOpen] = useState(false);
  const { showWarning, setShowWarning, stoppingServers, shouldShowWarning, killAllServers } =
    useServerCheck();

  const handleInstallFromHeader = async () => {
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

  const title = pageTitles[location.pathname] || 'Llama Manager';

  const hasAppUpdate = updateInfo.available;
  const hasNotifications = newBuilds.length > 0 || hasAppUpdate;

  const handleOpenTerminal = async () => {
    try {
      await invoke('open_terminal_window');
    } catch (err) {
      console.error('Failed to open terminal window:', err);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenTerminal}
            title="Open terminals window"
          >
            <Terminal className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {hasNotifications && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-peach" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              {hasAppUpdate && (
                <>
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Update Available
                  </DropdownMenuLabel>
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    <p>Version {updateInfo.version} is available</p>
                    {updateInfo.date && <p className="mt-0.5">{updateInfo.date}</p>}
                  </div>
                  <div className="px-2 py-1.5 flex gap-2">
                    <Button
                      onClick={() => setChangelogOpen(true)}
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Changelog
                    </Button>
                    <Button
                      onClick={handleInstallFromHeader}
                      disabled={isInstalling || stoppingServers}
                      size="sm"
                      className="flex-1 gap-2"
                    >
                      {stoppingServers ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isInstalling ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {stoppingServers
                        ? 'Stopping servers...'
                        : isInstalling
                          ? 'Installing...'
                          : 'Install & Restart'}
                    </Button>
                  </div>
                </>
              )}

              {newBuilds.length > 0 ? (
                <>
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Update Available
                  </DropdownMenuLabel>
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    <p>
                      Latest:{' '}
                      <span className="font-mono text-foreground">
                        {newBuilds[0].split(' / ')[0]}
                      </span>
                    </p>
                  </div>
                  <div className="px-2 py-1.5">
                    <Button
                      onClick={() => navigate('/catalog')}
                      size="sm"
                      variant="outline"
                      className="w-full gap-2"
                    >
                      <Download className="h-4 w-4" />
                      View in Catalog
                    </Button>
                  </div>
                </>
              ) : !hasAppUpdate ? (
                <DropdownMenuLabel>No notifications</DropdownMenuLabel>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-6" />
        </div>
      </div>

      <ChangelogModal
        open={changelogOpen}
        onOpenChange={setChangelogOpen}
        tagName={updateInfo.version ?? undefined}
        buildNumber={updateInfo.version ?? 'Update'}
        body={updateInfo.body ?? undefined}
      />

      {/* Warning dialog when servers are running */}
      <ServerRunningWarningDialog
        open={showWarning}
        onOpenChange={setShowWarning}
        onConfirm={handleConfirmWithServers}
      />
    </>
  );
}
