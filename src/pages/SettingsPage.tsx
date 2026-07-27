import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
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
  Info, Loader2, Eye, EyeOff,
  AlertCircle, X, Check, ChevronDown, Settings2,
  Brain, RefreshCw, Download,
} from 'lucide-react';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import type { AppSettings } from '@/types';
import { AVAILABLE_THEMES, getThemeById } from '@/themes';
import { AVAILABLE_FONTS } from '@/fonts';
import { AnimatePresence, motion } from 'framer-motion';

const TOAST_DURATIONS = [
  { label: '2s', value: 2000 },
  { label: '3s', value: 3000 },
  { label: '5s', value: 5000 },
];

export function SettingsPage() {
  const { settings, setSettings } = useAppStore();
  const { activeTheme, setActiveTheme } = useTheme();
  const { toast } = useToast();
  const { updateInfo, isChecking, isInstalling, checkUpdate, installUpdate, error: updateError } = useAppUpdate();
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local state for GitHub token (NOT in settings store)
  const [githubToken, setGithubToken] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('...');
  const appUpdateLastChecked = useAppStore((s) => s.appUpdateLastChecked);
  const [hasChecked, setHasChecked] = useState(true);

  // Debounce timers for folder auto-save
  const modelFolderSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mmprojFolderSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Debounce timer for mmproj_folder validation
  const mmprojValidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // mmproj_folder validation state
  const [mmprojValidation, setMmprojValidation] = useState<'valid' | 'invalid' | 'idle'>('idle');

  // Check if token exists on mount
  useEffect(() => {
    hasGithubToken().then(setHasToken).catch(() => {});
  }, []);

  // Load app version on mount
  useEffect(() => {
    invoke<string>('get_app_version').then(v => setAppVersion(v)).catch(() => {});
  }, []);



  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (modelFolderSaveTimerRef.current) {
        clearTimeout(modelFolderSaveTimerRef.current);
      }
      if (mmprojFolderSaveTimerRef.current) {
        clearTimeout(mmprojFolderSaveTimerRef.current);
      }
      if (mmprojValidateTimerRef.current) {
        clearTimeout(mmprojValidateTimerRef.current);
      }
    };
  }, []);

  // Handle save token
  const handleSaveToken = async () => {
    if (!githubToken.trim()) return;
    setIsSavingToken(true);
    try {
      await saveGithubToken(githubToken.trim());
      setHasToken(true);
      setGithubToken('');
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

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      <div className="max-w-3xl mx-auto w-full flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure your Llama Manager preferences.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Manage storage paths, appearance, notifications, and advanced options.
          </p>
        </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive flex-1">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Storage Path — WIP */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage
            <Badge variant="outline" className="ml-auto text-yellow border-yellow/30 bg-yellow/10 text-xs">WIP</Badge>
          </CardTitle>
          <CardDescription>
            Manage where llama.cpp versions are stored.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Storage Path
              <Badge variant="outline" className="text-yellow border-yellow/30 bg-yellow/10 text-xs">WIP</Badge>
            </Label>
            <div className="flex gap-2">
              <Input
                value={settings?.storage_path || ''}
                placeholder="Default: %LOCALAPPDATA%\llama-manager"
                className="bg-background/50 font-mono text-sm"
                disabled
              />
              <Button
                variant="outline"
                size="icon"
                title="Browse for folder (coming soon)"
                disabled
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                title="Apply typed path (coming soon)"
                disabled
              >
                <Save className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Models */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Models
          </CardTitle>
          <CardDescription>
            Configure the folder where your .gguf model files are stored.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Model Folder</Label>
            <div className="flex gap-2">
              <Input
                value={settings?.model_folder || ''}
                onChange={e => {
                  const val = e.target.value;
                  updateSetting('model_folder', val || undefined);
                  // Debounced auto-save
                  if (modelFolderSaveTimerRef.current) {
                    clearTimeout(modelFolderSaveTimerRef.current);
                  }
                  if (settings) {
                    modelFolderSaveTimerRef.current = setTimeout(() => {
                      saveSettings({ ...settings, model_folder: val || undefined }).catch(err => {
                        console.error('Failed to auto-save model_folder:', err);
                      });
                    }, 800);
                  }
                }}
                placeholder="Select a folder containing .gguf files"
                className="bg-background/50 font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                title="Browse for model folder"
                onClick={async () => {
                  try {
                    const selected = await selectFolder();
                    if (selected) {
                      updateSetting('model_folder', selected);
                      if (settings) {
                        await saveSettings({ ...settings, model_folder: selected });
                        toast({
                          title: 'Model folder updated',
                          description: `Models will be scanned from ${selected}`,
                        });
                      }
                    }
                  } catch (err) {
                    toast({
                      title: 'Error',
                      description: String(err),
                      variant: 'destructive',
                    });
                  }
                }}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This folder is used to browse and select model files when creating launch configurations.
            </p>
          </div>

          <Separator className="border-border/50" />

          {/* Mmproj Folder */}
          <div className="space-y-2">
            <Label>Mmproj Folder</Label>
            <div className="flex gap-2">
              <Input
                value={settings?.mmproj_folder || ''}
                onChange={e => {
                  const val = e.target.value;
                  updateSetting('mmproj_folder', val || undefined);
                  // Debounced auto-save
                  if (mmprojFolderSaveTimerRef.current) {
                    clearTimeout(mmprojFolderSaveTimerRef.current);
                  }
                  if (settings) {
                    mmprojFolderSaveTimerRef.current = setTimeout(() => {
                      saveSettings({ ...settings, mmproj_folder: val || undefined }).catch(err => {
                        console.error('Failed to auto-save mmproj_folder:', err);
                      });
                    }, 800);
                  }
                  // Debounced folder validation
                  if (mmprojValidateTimerRef.current) {
                    clearTimeout(mmprojValidateTimerRef.current);
                  }
                  if (!val.trim()) {
                    setMmprojValidation('idle');
                  } else {
                    mmprojValidateTimerRef.current = setTimeout(async () => {
                      try {
                        await invoke('validate_folder', { path: val.trim() });
                        setMmprojValidation('valid');
                      } catch {
                        setMmprojValidation('invalid');
                      }
                    }, 500);
                  }
                }}
                placeholder="Select a folder containing .mmproj files"
                className="bg-background/50 font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                title="Browse for mmproj folder"
                onClick={async () => {
                  try {
                    const selected = await selectFolder();
                    if (selected) {
                      updateSetting('mmproj_folder', selected);
                      if (settings) {
                        await saveSettings({ ...settings, mmproj_folder: selected });
                        toast({
                          title: 'Mmproj folder updated',
                          description: `Mmproj files will be scanned from ${selected}`,
                        });
                      }
                      // Validate the selected folder
                      try {
                        await invoke('validate_folder', { path: selected });
                        setMmprojValidation('valid');
                      } catch {
                        setMmprojValidation('invalid');
                      }
                    }
                  } catch (err) {
                    toast({
                      title: 'Error',
                      description: String(err),
                      variant: 'destructive',
                    });
                  }
                }}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This folder is used to browse and select .mmproj files for model overrides.
            </p>
            {mmprojValidation === 'invalid' && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Folder does not exist or is not accessible.
              </p>
            )}
            {mmprojValidation === 'valid' && (
              <p className="text-xs text-green flex items-center gap-1">
                <Check className="h-3 w-3" />
                Folder exists and is accessible.
              </p>
            )}
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
                const isActive = activeTheme === theme.id;
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
                            description: 'Could not persist theme. Changes will be lost on restart.',
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
                const isActive = settings?.font_family === font.cssFamily;
                return (
                  <Button
                    key={font.id}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    className={isActive ? 'ring-2 ring-accent ring-offset-2 ring-offset-background' : ''}
                    style={{ fontFamily: font.cssFamily }}
                    onClick={() => {
                      updateSetting('font_family', font.cssFamily);
                      // Auto-save font choice (fire-and-forget)
                      if (settings) {
                        saveSettings({ ...settings, font_family: font.cssFamily }).catch(err => {
                          console.error('Failed to auto-save font:', err);
                          toast({
                            title: 'Save failed',
                            description: 'Could not persist font. Changes will be lost on restart.',
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
              onClick={() => {
                if (settings) {
                  const val = !settings.auto_check_updates;
                  updateSetting('auto_check_updates', val);
                  saveSettings({ ...settings, auto_check_updates: val }).catch(err => {
                    console.error('Failed to save auto_check_updates:', err);
                  });
                  toast({
                    title: val ? 'Auto-check enabled' : 'Auto-check disabled',
                    description: val ? 'Will check for updates on startup.' : 'Won\'t check for updates on startup.',
                  });
                }
              }}
            >
              {settings?.auto_check_updates ? 'On' : 'Off'}
            </Button>
          </div>

          <Separator className="border-border/50" />

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
              onClick={() => {
                if (settings) {
                  const val = !settings.show_update_modal;
                  updateSetting('show_update_modal', val);
                  saveSettings({ ...settings, show_update_modal: val }).catch(err => {
                    console.error('Failed to save show_update_modal:', err);
                  });
                  toast({
                    title: val ? 'Update modal enabled' : 'Update modal disabled',
                    description: val ? 'Will show changelog on startup when update available.' : 'Won\'t show changelog modal on startup.',
                  });
                }
              }}
            >
              {settings?.show_update_modal ? 'On' : 'Off'}
            </Button>
          </div>

          <Separator className="border-border/50" />

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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => installUpdate()}
                  disabled={isInstalling}
                  className="text-peach border-peach/30 hover:bg-peach/10 hover:text-peach"
                >
                  {isInstalling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {isInstalling ? 'Installing...' : 'Install & Restart'}
                </Button>
              </div>
            )}
          </div>

          <Separator className="border-border/50" />

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
                    className={isActive ? 'ring-2 ring-accent ring-offset-2 ring-offset-background' : ''}
                    onClick={() => {
                      updateSetting('toast_duration', opt.value);
                      toast({
                        title: 'Toast duration updated',
                        description: `Notifications will stay visible for ${opt.label}.`,
                      });
                      // Auto-save toast duration (fire-and-forget)
                      if (settings) {
                        saveSettings({ ...settings, toast_duration: opt.value }).catch(err => {
                          console.error('Failed to auto-save toast duration:', err);
                          toast({
                            title: 'Save failed',
                            description: 'Could not persist toast duration. Changes will be lost on restart.',
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
      <Card className="border-yellow/20 bg-card/50">
        <CardHeader className="cursor-pointer" onClick={() => setAdvancedOpen(v => !v)}>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Advanced
              <Badge variant="outline" className="text-[10px] font-normal">Power Users</Badge>
            </span>
            <motion.div
              animate={{ rotate: advancedOpen ? 180 : 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          </CardTitle>
          <CardDescription>
            Advanced configuration for power users. API tokens and rate limiting options.
          </CardDescription>
        </CardHeader>
        <AnimatePresence>
          {advancedOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
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
                        className="bg-background/50 font-mono text-sm pr-10 [-webkit-text-security-disc:none] [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
                        style={{ WebkitAppearance: 'none' } as any}
                      />
                      {(githubToken.length > 0 || hasToken) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowToken(v => !v)}
                        >
                          {showToken ? (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      )}
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
                    Your token is stored locally and only used for GitHub API requests.
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
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* About */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            About
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Llama Manager</strong>{' '}
            {appVersion ? `v${appVersion}` : '...'}
          </p>

          <p className="text-sm text-muted-foreground">
            A modern Windows application for managing llama.cpp builds.
          </p>
          <p className="text-sm text-muted-foreground">
            Built with Tauri, React, and Rust.
          </p>
        </CardContent>
      </Card>
      </div> {/* end max-w-3xl mx-auto wrapper */}
    </div>
  );
}
