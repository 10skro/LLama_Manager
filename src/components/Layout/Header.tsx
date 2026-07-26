import { useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bell, Terminal, Download, Loader2 } from 'lucide-react';
import { useAppUpdate } from '@/hooks/useAppUpdate';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/catalog': 'Catalog',
  '/settings': 'Settings',
};

export function Header() {
  const location = useLocation();
  const { newBuilds } = useAppStore();
  const { updateInfo, isInstalling, installUpdate } = useAppUpdate();

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
                  {updateInfo.date && (
                    <p className="mt-0.5">{updateInfo.date}</p>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => installUpdate()}
                  disabled={isInstalling}
                  className="gap-2 text-peach focus:text-peach"
                >
                  {isInstalling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {isInstalling ? 'Installing...' : 'Install & Restart'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            {newBuilds.length > 0 ? (
              <>
                <DropdownMenuLabel>{newBuilds.length} New Builds</DropdownMenuLabel>
                {newBuilds.slice(0, 5).map((build) => (
                  <DropdownMenuItem key={build}>
                    {build}
                  </DropdownMenuItem>
                ))}
                {newBuilds.length > 5 && (
                  <DropdownMenuItem className="text-muted-foreground">
                    +{newBuilds.length - 5} more...
                  </DropdownMenuItem>
                )}
              </>
            ) : !hasAppUpdate ? (
              <DropdownMenuLabel>No notifications</DropdownMenuLabel>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-6" />
      </div>
    </div>
  );
}
