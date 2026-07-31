import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { saveSettings } from '@/services/settings';
import type { AppSettings } from '@/types';

/**
 * Centralized settings persistence hook (FR-005, TD-004).
 * Replaces 8 duplicated inline saveSettings+toast patterns in SettingsPage.
 */
export function useSettingsPersistence(
  settings: AppSettings | null,
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
) {
  const { toast } = useToast();

  /**
   * Persist a single setting change with toast feedback on error.
   * Returns early if settings is null (not yet loaded).
   */
  const persistSetting = useCallback(
    <K extends keyof AppSettings>(
      key: K,
      value: AppSettings[K],
      successToast?: { title: string; description: string }
    ) => {
      if (!settings) return;

      updateSetting(key, value);

      if (successToast) {
        toast(successToast);
      }

      saveSettings({ ...settings, [key]: value }).catch((err) => {
        console.error(`Failed to auto-save ${key}:`, err);
        toast({
          title: 'Save failed',
          description: `Could not persist ${key}. Changes will be lost on restart.`,
          variant: 'destructive',
        });
      });
    },
    [settings, updateSetting, toast]
  );

  /**
   * Toggle a boolean setting and persist with On/Off toast feedback.
   */
  const toggleBooleanSetting = useCallback(
    <K extends keyof AppSettings>(
      key: K,
      current: boolean,
      labels: { on: string; off: string }
    ) => {
      if (!settings) return;

      const next = !current;
      updateSetting(key, next as AppSettings[K]);

      toast({
        title: next ? labels.on : labels.off,
        description: next ? `${key} enabled.` : `${key} disabled.`,
      });

      saveSettings({ ...settings, [key]: next as AppSettings[K] }).catch((err) => {
        console.error(`Failed to save ${key}:`, err);
      });
    },
    [settings, updateSetting, toast]
  );

  return { persistSetting, toggleBooleanSetting };
}
