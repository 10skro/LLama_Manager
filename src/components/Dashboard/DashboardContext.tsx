import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type {
  CardCustomization,
  VersionOverride,
  VersionConfigLink,
  ConfigEntry,
  CardClipboardData,
} from '@/types';

/* ─── Temp editing state for the customize dropdown ─── */

interface TempEditState {
  versionId: number | null;
  title: string;
  color: string;
  textColor: string;
}

/* ─── Context shape ─── */

interface DashboardContextValue {
  // Card customizations
  cardCustomizations: Record<number, CardCustomization>;
  setCustomization: (versionId: number, customization?: CardCustomization) => void;

  // Version overrides
  versionOverrides: Record<number, VersionOverride>;
  setOverride: (versionId: number, override: VersionOverride | null) => void;

  // Config links
  getLink: (versionId: number) => VersionConfigLink | undefined;
  setLink: (versionId: number, configType: 'custom', configId: string) => Promise<void>;
  removeLink: (versionId: number) => Promise<void>;
  configs: ConfigEntry[];
  configsLoading: boolean;

  // Clipboard
  clipboardData: CardClipboardData | null;
  setClipboardData: (data: CardClipboardData | null) => void;

  // Editing dropdown (shared across all cards)
  editingDropdownId: number | null;
  tempTitle: string;
  tempColor: string;
  tempTextColor: string;
  openEditDropdown: (versionId: number, customization?: CardCustomization) => void;
  closeEditDropdown: () => void;
  setTempTitle: (title: string) => void;
  setTempColor: (color: string) => void;
  setTempTextColor: (color: string) => void;

  // Settings
  modelFolder: string | undefined;
  mmprojFolder: string | undefined;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

/* ─── Hook ─── */

export function useDashboardContext(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error('useDashboardContext must be used within DashboardProvider');
  }
  return ctx;
}

/* ─── Provider ─── */

interface DashboardProviderProps {
  children: React.ReactNode;
  getLink: (versionId: number) => VersionConfigLink | undefined;
  setLink: (versionId: number, configType: 'custom', configId: string) => Promise<void>;
  removeLink: (versionId: number) => Promise<void>;
  configs: ConfigEntry[];
  configsLoading: boolean;
  modelFolder?: string;
  mmprojFolder?: string;
}

export function DashboardProvider({
  children,
  getLink,
  setLink,
  removeLink,
  configs,
  configsLoading,
  modelFolder,
  mmprojFolder,
}: DashboardProviderProps) {
  const [cardCustomizations, setCardCustomizations] = useState<Record<number, CardCustomization>>({});
  const [versionOverrides, setVersionOverrides] = useState<Record<number, VersionOverride>>({});
  const [clipboardData, setClipboardData] = useState<CardClipboardData | null>(null);

  // Shared editing state: only one card's customize dropdown can be open at a time
  const [tempEdit, setTempEdit] = useState<TempEditState>({
    versionId: null,
    title: '',
    color: '',
    textColor: '',
  });

  const setCustomization = useCallback((versionId: number, customization?: CardCustomization) => {
    setCardCustomizations(prev => {
      const next = { ...prev };
      if (customization) {
        next[versionId] = customization;
      } else {
        delete next[versionId];
      }
      return next;
    });
  }, []);

  const setOverride = useCallback((versionId: number, override: VersionOverride | null) => {
    setVersionOverrides(prev => {
      const next = { ...prev };
      if (override) {
        next[versionId] = override;
      } else {
        delete next[versionId];
      }
      return next;
    });
  }, []);

  const openEditDropdown = useCallback((versionId: number, customization?: CardCustomization) => {
    setTempEdit({
      versionId,
      title: customization?.title ?? '',
      color: customization?.header_color ?? '',
      textColor: customization?.text_color ?? '',
    });
  }, []);

  const closeEditDropdown = useCallback(() => {
    setTempEdit({ versionId: null, title: '', color: '', textColor: '' });
  }, []);

  const setTempTitle = useCallback((title: string) => {
    setTempEdit(prev => ({ ...prev, title }));
  }, []);

  const setTempColor = useCallback((color: string) => {
    setTempEdit(prev => ({ ...prev, color }));
  }, []);

  const setTempTextColor = useCallback((textColor: string) => {
    setTempEdit(prev => ({ ...prev, textColor }));
  }, []);

  const value = useMemo<DashboardContextValue>(
    () => ({
      cardCustomizations,
      setCustomization,
      versionOverrides,
      setOverride,
      getLink,
      setLink,
      removeLink,
      configs,
      configsLoading,
      clipboardData,
      setClipboardData,
      editingDropdownId: tempEdit.versionId,
      tempTitle: tempEdit.title,
      tempColor: tempEdit.color,
      tempTextColor: tempEdit.textColor,
      openEditDropdown,
      closeEditDropdown,
      setTempTitle,
      setTempColor,
      setTempTextColor,
      modelFolder,
      mmprojFolder,
    }),
    [
      cardCustomizations,
      setCustomization,
      versionOverrides,
      setOverride,
      getLink,
      setLink,
      removeLink,
      configs,
      configsLoading,
      clipboardData,
      tempEdit,
      openEditDropdown,
      closeEditDropdown,
      setTempTitle,
      setTempColor,
      setTempTextColor,
      modelFolder,
      mmprojFolder,
    ],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
