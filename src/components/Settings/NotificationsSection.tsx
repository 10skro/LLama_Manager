import { useState } from 'react';
import { Bell, Loader2, RefreshCw, Download, FileText, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import type { AppSettings } from '@/types';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { useSettingsPersistence } from '@/hooks/Settings/useSettingsPersistence';
import { ChangelogModal } from '@/components/shared/ChangelogModal';
import { ServerRunningWarningDialog } from '@/components/shared/ServerRunningWarningDialog';
import { useServerCheck } from '@/hooks/useServerCheck';

const TOAST_DURATIONS = [
  { label: '2s', value: 2000 },
  { label: '3s', value: 3000 },
  { label: '5s', value: 5000 },
];

interface NotificationsSectionProps {
  settings: AppSettings | null;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  appUpdateLastChecked: string | null;
}

/**
 * Notifications section — update checks, toast duration, and update install UI.
 */
export function NotificationsSection({
  settings,
  updateSetting,
  appUpdateLastChecked,
}: NotificationsSectionProps) {
  const { persistSetting, toggleBooleanSetting } = useSettingsPersistence(settings, updateSetting);
  const {
    updateInfo,
    isChecking,
    isInstalling,
    checkUpdate,
    installUpdate,
    error: updateError,
  } = useAppUpdate();
  const { showWarning, setShowWarning, stoppingServers, shouldShowWarning, killAllServers } =
    useServerCheck();

  const [hasChecked, setHasChecked] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);

  const handleInstallFromSettings = async () => {
    const warning = await shouldShowWarning();
    if (warning) return;
    await installUpdate(updateInfo.version ?? undefined, updateInfo.body ?? undefined);
  };

  const handleConfirmWithServers = async () => {
    await killAllServers();
    await installUpdate(updateInfo.version ?? undefined, updateInfo.body ?? undefined);
  };

  return (
    <>
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>Control update checks and notifications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto-check for updates */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label>Auto-check for updates</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Automatically check for new app versions on startup.
              </p>
            </div>
            <Button
              variant={settings?.auto_check_updates ? 'default' : 'outline'}
              size="sm"
              onClick={() =>
                toggleBooleanSetting('auto_check_updates', !!settings?.auto_check_updates, {
                  on: 'Auto-check enabled',
                  off: 'Auto-check disabled',
                })
              }
            >
              {settings?.auto_check_updates ? 'On' : 'Off'}
            </Button>
          </div>

          <Separator className="border-border/50" />

          {/* Show update modal on startup */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label>Show update modal on startup</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Display changelog dialog when a new version is available.
              </p>
            </div>
            <Button
              variant={settings?.show_update_modal ? 'default' : 'outline'}
              size="sm"
              onClick={() =>
                toggleBooleanSetting('show_update_modal', !!settings?.show_update_modal, {
                  on: 'Update modal enabled',
                  off: 'Update modal disabled',
                })
              }
            >
              {settings?.show_update_modal ? 'On' : 'Off'}
            </Button>
          </div>

          <Separator className="border-border/50" />

          {/* Last checked */}
          <div className="flex items-center gap-4">
            <div>
              <Label>Last checked</Label>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {appUpdateLastChecked ? new Date(appUpdateLastChecked).toLocaleString() : 'Never'}
            </Badge>
          </div>

          <Separator className="border-border/50" />

          {/* Manual check for update */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Check for updates</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Manually check for a new app version.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setHasChecked(true);
                  await checkUpdate();
                }}
                disabled={isChecking || isInstalling}
              >
                {isChecking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Check for update
              </Button>
            </div>

            {hasChecked && updateError && (
              <p className="text-sm text-red flex items-center gap-1.5">
                <X className="h-4 w-4" />
                Update check failed: {updateError}
              </p>
            )}

            {hasChecked && !isChecking && !updateInfo.available && !updateError && (
              <p className="text-sm text-green flex items-center gap-1.5">
                <Check className="h-4 w-4" />
                You are up to date.
              </p>
            )}

            {hasChecked && updateInfo.available && (
              <div className="rounded-lg border border-peach/30 bg-peach/10 p-3 space-y-2">
                <p className="text-sm text-peach flex items-center gap-1.5">
                  <Download className="h-4 w-4" />
                  Version {updateInfo.version} is available
                </p>
                {updateInfo.date && (
                  <p className="text-xs text-muted-foreground">{updateInfo.date}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setChangelogOpen(true)}
                    className="text-peach border-peach/30 hover:bg-peach/10 hover:text-peach"
                  >
                    <FileText className="h-4 w-4" />
                    View Changelog
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleInstallFromSettings}
                    disabled={isInstalling || stoppingServers}
                    className="text-peach border-peach/30 hover:bg-peach/10 hover:text-peach"
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
              </div>
            )}
          </div>

          <Separator className="border-border/50" />

          {/* Toast duration */}
          <div className="flex items-center gap-4">
            <div>
              <Label>Toast notification duration</Label>
              <p className="text-xs text-muted-foreground mt-1">
                How long notification toasts remain visible.
              </p>
            </div>
            <div className="flex gap-1.5" role="group" aria-label="Toast notification duration">
              {TOAST_DURATIONS.map((opt) => {
                const isActive = (settings?.toast_duration ?? 5000) === opt.value;
                return (
                  <Button
                    key={opt.value}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    className={
                      isActive ? 'ring-2 ring-accent ring-offset-2 ring-offset-background' : ''
                    }
                    onClick={() =>
                      persistSetting('toast_duration', opt.value, {
                        title: 'Toast duration updated',
                        description: `Notifications will stay visible for ${opt.label}.`,
                      })
                    }
                  >
                    {opt.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <ChangelogModal
        open={changelogOpen}
        onOpenChange={setChangelogOpen}
        tagName={updateInfo.version ?? undefined}
        buildNumber={updateInfo.version ?? 'Update'}
        body={updateInfo.body || undefined}
      />

      <ServerRunningWarningDialog
        open={showWarning}
        onOpenChange={setShowWarning}
        onConfirm={handleConfirmWithServers}
      />
    </>
  );
}
