import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/hooks/useTheme';
import type { AppSettings } from '@/types';
import {
  StorageSection,
  ModelsSection,
  AppearanceSection,
  NotificationsSection,
  AdvancedSection,
  AboutSection,
} from '@/components/Settings';

export function SettingsPage() {
  const { settings, setSettings } = useAppStore();
  const { activeTheme, setActiveTheme } = useTheme();
  const appUpdateLastChecked = useAppStore((s) => s.appUpdateLastChecked);
  const [appVersion, setAppVersion] = useState('...');

  // Load app version on mount
  useEffect(() => {
    invoke<string>('get_app_version')
      .then((v) => setAppVersion(v))
      .catch(() => {});
  }, []);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      <div className="max-w-3xl mx-auto w-full flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Configure your Llama Manager preferences.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Manage storage paths, appearance, notifications, and advanced options.
          </p>
        </div>

        <StorageSection settings={settings} />
        <ModelsSection settings={settings} updateSetting={updateSetting} />
        <AppearanceSection
          settings={settings}
          updateSetting={updateSetting}
          activeTheme={activeTheme}
          setActiveTheme={setActiveTheme}
        />
        <NotificationsSection
          settings={settings}
          updateSetting={updateSetting}
          appUpdateLastChecked={appUpdateLastChecked}
        />
        <AdvancedSection />
        <AboutSection appVersion={appVersion} />
      </div>
    </div>
  );
}
