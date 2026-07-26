import { useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Bell, Terminal } from 'lucide-react';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/catalog': 'Catalog',
  '/settings': 'Settings',
};

export function Header() {
  const location = useLocation();
  const { newBuilds } = useAppStore();

  const title = pageTitles[location.pathname] || 'Llama Manager';

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
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {newBuilds.length > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {newBuilds.length}
            </Badge>
          )}
        </Button>
        <Separator orientation="vertical" className="h-6" />
      </div>
    </div>
  );
}
