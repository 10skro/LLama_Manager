import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/use-toast';
import { getSettings, saveSettings, selectFolder } from '@/services/settings';
import { saveGithubToken, hasGithubToken, deleteGithubToken } from '@/services/github-token';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  FolderOpen, Save, HardDrive, Palette, Bell,
  Info, Loader2, CheckCircle2, Eye, EyeOff,
  AlertCircle, X, Check, ChevronDown, ChevronUp, Settings2,
} from 'lucide-react';
import type { AppSettings } from '@/types';
import { AVAILABLE_THEMES, getThemeById } from '@/themes';
import { AVAILABLE_FONTS } from '@/fonts';

const TOAST_DURATIONS = [
  { label: '2s', value: 2000 },
  { label: '3s', value: 3000 },
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: '30s', value: 30000 },
  { label: 'Permanent', value: 0 },
];

export function SettingsPage() {
  const { settings, setSettings } = useAppStore();
  const { setActiveTheme } = useTheme();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local state for GitHub token (NOT in settings store)
  const [githubToken, setGithubToken] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Check if token exists on mount
  useEffect(() => {
    hasGithubToken().then(setHasToken).catch(() => {});
  }, []);

  // Handle save token
  const handleSaveToken = async () => {
    if (!githubToken.trim()) return;
    setIsSavingToken(true);
    try {
      await saveGithubToken(githubToken.trim());
      setHasToken(true);
      toast({ title: 'Token saved', description: 'GitHub token saved securely.' });
    } catch (err) {
      toast({ title: 'Save failed', description: String(err), variant: 'destructive' });
    } finally {
      setIsSavingToken(false);
    }
  };

  // Handle clear token
  const handleClearToken = async () => {
    try {
      await deleteGithubToken();
      setGithubToken('');
      setHasToken(false);
      toast({ title: 'Token removed', description: 'GitHub token has been cleared.' });
    } catch (err) {
      toast({ title: 'Clear failed', description: String(err), variant: 'destructive' });
    }
  };

  // Kept for manual reload usage (e.g., refresh button)
  // @ts-expect-error TS6133 - intentionally unused, reserved for future refresh feature
  const loadSettings = async () => {
    try {
      const s = await getSettings();
      setSettings(s);

      // Sync theme on settings load
      if (s.theme) {
        const theme = getThemeById(s.theme);
        if (theme) {
          setActiveTheme(s.theme);
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('Failed to load settings. Please try again.');
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setError(null);
    setIsSaving(true);
    try {
      await saveSettings(settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const handleBrowse = async () => {
    setIsBrowsing(true);
    setError(null);
    try {
      const selected = await selectFolder();
      if (selected) {
        updateSetting('storage_path', selected);
        // Auto-save storage path to DB to avoid race condition where
        // a download started before "Save Changes" would use the old path.
        if (settings) {
          saveSettings({ ...settings, storage_path: selected }).catch(err => {
            console.error('Failed to auto-save storage path:', err);
            setError('Could not persist storage path. Click Save Changes to retry.');
          });
        }
      }
    } catch (err) {
      console.error('Failed to open folder dialog:', err);
      setError('Failed to open folder dialog. Please try again.');
    } finally {
      setIsBrowsing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure your LlamaCpp Manager preferences.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Storage Path */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage
          </CardTitle>
          <CardDescription>
            Manage where llama.cpp versions are stored.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Storage Path</Label>
            <div className="flex gap-2">
              <Input
                value={settings?.storage_path || ''}
                onChange={e => updateSetting('storage_path', e.target.value)}
                placeholder="Default: %APPDATA%\LlamaCppManager"
                className="bg-background/50 font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                title="Browse for folder"
                onClick={handleBrowse}
                disabled={isBrowsing}
              >
                {isBrowsing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderOpen className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Appearance
          </CardTitle>
          <CardDescription>
            Customize the look and feel of the application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Theme</Label>
            <div className="flex gap-2 flex-wrap">
              {AVAILABLE_THEMES.map((theme) => {
                const isActive = settings?.theme === theme.id;
                return (
                  <Button
                    key={theme.id}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    className={isActive ? 'ring-2 ring-accent ring-offset-2 ring-offset-background' : ''}
                    onClick={() => {
                      updateSetting('theme', theme.id);
                      setActiveTheme(theme.id);
                      // Auto-save theme choice (fire-and-forget)
                      if (settings) {
                        saveSettings({ ...settings, theme: theme.id }).catch(err => {
                          console.error('Failed to auto-save theme:', err);
                          toast({
                            title: 'Save failed',
                            description: 'Could not persist theme. Click Save Changes to retry.',
                            variant: 'destructive',
                          });
                        });
                      }
                      toast({
                        title: 'Theme changed',
                        description: `Applied ${theme.name}`,
                      });
                    }}
                   >
                    {isActive && <Check className="h-3.5 w-3.5 mr-1.5" />}
                    {theme.name}
                  </Button>
                );
              })}
            </div>
          </div>

          <Separator className="border-border/50" />

          {/* Font selector */}
          <div className="space-y-2">
            <Label>Font</Label>
            <div className="flex gap-2 flex-wrap">
              {AVAILABLE_FONTS.map((font) => {
                const isActive = settings?.fontFamily === font.cssFamily;
                return (
                  <Button
                    key={font.id}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    className={isActive ? 'ring-2 ring-accent ring-offset-2 ring-offset-background' : ''}
                    style={{ fontFamily: font.cssFamily }}
                    onClick={() => {
                      updateSetting('fontFamily', font.cssFamily);
                      // Apply font instantly
                      document.documentElement.style.setProperty('--custom-font', font.cssFamily);
                      // Auto-save font choice (fire-and-forget)
                      if (settings) {
                        saveSettings({ ...settings, fontFamily: font.cssFamily }).catch(err => {
                          console.error('Failed to auto-save font:', err);
                          toast({
                            title: 'Save failed',
                            description: 'Could not persist font. Click Save Changes to retry.',
                            variant: 'destructive',
                          });
                        });
                      }
                      toast({
                        title: 'Font changed',
                        description: `Applied ${font.name}`,
                      });
                    }}
                  >
                    {isActive && <Check className="h-3.5 w-3.5 mr-1.5" />}
                    {font.name}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Control update checks and notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-check for updates</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Automatically check for new builds on startup.
              </p>
            </div>
            <Button
              variant={settings?.auto_check_updates ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateSetting('auto_check_updates', !settings?.auto_check_updates)}
            >
              {settings?.auto_check_updates ? 'On' : 'Off'}
            </Button>
          </div>

          <Separator className="border-border/50" />

          <div className="flex items-center justify-between">
            <div>
              <Label>Last checked</Label>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {settings?.last_fetch ? new Date(settings.last_fetch).toLocaleString() : 'Never'}
            </Badge>
          </div>

          <Separator className="border-border/50" />

          <div className="flex items-center justify-between">
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
                    className={isActive ? 'ring-2 ring-accent ring-offset-2 ring-offset-background' : ''}
                    onClick={() => {
                      updateSetting('toast_duration', opt.value);
                      // Auto-save toast duration (fire-and-forget)
                      if (settings) {
                        saveSettings({ ...settings, toast_duration: opt.value }).catch(err => {
                          console.error('Failed to auto-save toast duration:', err);
                          toast({
                            title: 'Save failed',
                            description: 'Could not persist toast duration. Click Save Changes to retry.',
                            variant: 'destructive',
                          });
                        });
                      }
                    }}
                  >
                    {opt.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced (collapsible) */}
      <Card className="border-amber-500/20 bg-card/50">
        <CardHeader className="cursor-pointer" onClick={() => setAdvancedOpen(v => !v)}>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Advanced
              <Badge variant="outline" className="text-[10px] font-normal">Power Users</Badge>
            </span>
            {advancedOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </CardTitle>
          <CardDescription>
            Advanced configuration for power users. API tokens and rate limiting options.
          </CardDescription>
        </CardHeader>
        {advancedOpen && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>GitHub API</Label>
              <p className="text-xs text-muted-foreground">
                Optional: Add a personal access token to increase the GitHub API rate limit from 60 to 5000 requests per hour.
              </p>
            </div>

            <div className="space-y-2">
              <Label>GitHub Personal Access Token</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showToken ? 'text' : 'password'}
                    value={githubToken}
                    onChange={e => setGithubToken(e.target.value)}
                    placeholder={hasToken ? 'Token is configured (edit to update)' : 'ghp_...'}
                    className="bg-background/50 font-mono text-sm pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowToken(v => !v)}
                  >
                    {showToken ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {hasToken && githubToken.length === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearToken}
                  >
                    Clear
                  </Button>
                )}
                {githubToken.length > 0 && (
                  <Button
                    size="sm"
                    onClick={handleSaveToken}
                    disabled={isSavingToken}
                  >
                    {isSavingToken ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Your token is stored securely in the Windows Credential Manager and only used for GitHub API requests.
                Create a token at{' '}
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  github.com/settings/tokens
                </a>
                . No scopes are required.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isSaving || saveSuccess}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : saveSuccess ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Saved!
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* About */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            About
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p><strong className="text-foreground">LlamaCpp Manager</strong> v0.1.0</p>
          <p>A modern Windows application for managing llama.cpp builds.</p>
          <p>Built with Tauri, React, and Rust.</p>
        </CardContent>
      </Card>
    </div>
  );
}
