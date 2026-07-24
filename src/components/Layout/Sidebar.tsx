import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard, FileStack, Package, Settings as SettingsIcon,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/configs', label: 'Configs', icon: FileStack },
  { path: '/catalog', label: 'Catalog', icon: Package },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  return (
    <div
      className={cn(
        'flex flex-col border-r border-border/50 bg-sidebar transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Llama</span>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
        )}
      </div>

      <Separator className="border-border/50" />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2 py-4">
        <nav className="flex flex-col gap-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path;
            return (
              <Button
                key={path}
                variant="ghost"
                onClick={() => navigate(path)}
                className={cn(
                  'justify-start gap-3',
                  sidebarCollapsed ? 'px-3' : 'px-4',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!sidebarCollapsed && <span>{label}</span>}
              </Button>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <Separator className="border-border/50" />
      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={cn(
            'w-full justify-center',
            sidebarCollapsed ? 'px-2' : 'justify-start gap-2 px-4'
          )}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
