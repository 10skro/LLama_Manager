import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '@/hooks/use-toast';
import { saveSettings, selectFolder } from '@/services/settings';
import type { AppSettings } from '@/types';

interface UseDebouncedFolderInputOptions {
  /** Current settings object from store */
  settings: AppSettings | null;
  /** Setting key to update (e.g. 'model_folder') */
  settingKey: keyof Pick<AppSettings, 'model_folder' | 'mmproj_folder'>;
  /** Update the local store before persisting */
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  /** Human-readable label for toast messages */
  label: string;
  /** Scan description for toast */
  scanDescription: string;
  /** Debounce delay in ms for auto-save (default 800) */
  saveDebounceMs?: number;
  /** Debounce delay in ms for folder validation (default 500) */
  validateDebounceMs?: number;
}

type ValidationState = 'valid' | 'invalid' | 'idle';

/**
 * Debounced folder input hook (FR-002, TD-002).
 * Handles: onChange with debounce auto-save, folder browse button, and folder validation.
 * Replaces 3 duplicated inline patterns in SettingsPage.
 */
export function useDebouncedFolderInput({
  settings,
  settingKey,
  updateSetting,
  label,
  scanDescription,
  saveDebounceMs = 800,
  validateDebounceMs = 500,
}: UseDebouncedFolderInputOptions) {
  const { toast } = useToast();
  const [validation, setValidation] = useState<ValidationState>('idle');

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (validateTimerRef.current) clearTimeout(validateTimerRef.current);
    };
  }, []);

  const currentValue = settings?.[settingKey] ?? '';

  /**
   * Handle manual text input with debounced auto-save and validation.
   */
  const handleChange = useCallback(
    (value: string) => {
      updateSetting(settingKey, value || undefined);

      // Debounced auto-save
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (settings) {
        saveTimerRef.current = setTimeout(() => {
          saveSettings({ ...settings, [settingKey]: value || undefined }).catch((err) => {
            console.error(`Failed to auto-save ${settingKey}:`, err);
          });
        }, saveDebounceMs);
      }

      // Debounced folder validation
      if (validateTimerRef.current) clearTimeout(validateTimerRef.current);
      if (!value.trim()) {
        setValidation('idle');
      } else {
        validateTimerRef.current = setTimeout(async () => {
          try {
            await invoke('validate_folder', { path: value.trim() });
            setValidation('valid');
          } catch {
            setValidation('invalid');
          }
        }, validateDebounceMs);
      }
    },
    [settings, settingKey, updateSetting, saveDebounceMs, validateDebounceMs]
  );

  /**
   * Handle folder selection via system dialog.
   */
  const handleBrowse = useCallback(async () => {
    try {
      const selected = await selectFolder();
      if (!selected) return;

      updateSetting(settingKey, selected);

      if (settings) {
        await saveSettings({ ...settings, [settingKey]: selected });
        toast({
          title: `${label} folder updated`,
          description: `${scanDescription}`,
        });
      }

      // Validate the selected folder immediately
      try {
        await invoke('validate_folder', { path: selected });
        setValidation('valid');
      } catch {
        setValidation('invalid');
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: String(err),
        variant: 'destructive',
      });
    }
  }, [settings, settingKey, updateSetting, label, scanDescription, toast]);

  return {
    value: currentValue,
    validation,
    handleChange,
    handleBrowse,
  };
}
