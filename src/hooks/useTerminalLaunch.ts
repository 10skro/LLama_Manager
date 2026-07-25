import { useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/store/useAppStore';
import type { InstalledVersion, ConfigEntry, VersionConfigLink, VersionOverride } from '@/types';

interface UseTerminalLaunchParams {
  version: InstalledVersion;
  configLink: VersionConfigLink | null;
  configs: ConfigEntry[];
  override?: VersionOverride | null;
  onError?: (message: string) => void;
}

export function useTerminalLaunch({
  version,
  configLink,
  configs,
  override,
  onError,
}: UseTerminalLaunchParams) {
  const setTerminalVisible = useAppStore((state) => state.setTerminalVisible);
  const setActiveTerminalId = useAppStore((state) => state.setActiveTerminalId);
  const injectingRef = useRef(false);

  const handlePlay = useCallback(async () => {
    // Guard: no config link or already injecting
    if (!configLink || injectingRef.current) return;

    const installPath = version.install_path;

    // Validate config exists BEFORE setting injectingRef
    // Use fresh configs from useConfigs() instead of stale Zustand store
    const config = configs.find((c) => c.type === configLink.config_type && c.id === configLink.config_id);
    if (!config) {
      console.error('Config not found:', configLink.config_id);
      onError?.('Linked configuration not found. It may have been deleted.');
      return;
    }

    const startupCommand = config.command;
    // Auto-prepend llama-server.exe if command doesn't already start with an executable
    const needsPrefix = startupCommand && !startupCommand.trim().startsWith('llama-server') && !startupCommand.trim().startsWith('.\\') && !startupCommand.trim().startsWith('..\\');
    const fullCommand = needsPrefix
      ? `llama-server.exe ${startupCommand}`
      : startupCommand;
    console.log('[PLAY] Config found:', config.name, 'Full command:', fullCommand);

    // Only set injectingRef after validation passes
    injectingRef.current = true;

    try {
      // Join all lines into one: remove ^ and newlines, replace with spaces
      let singleLine = (fullCommand || '')
        .split(/\r?\n/)
        .map(line => line.replace(/\s*\^\s*$/, '').trim())
        .filter(line => line.length > 0)
        .join(' ');

      // Inject override model_path and mmproj_path if present
      if (override) {
        if (override.model_path) {
          // Replace existing -m "<path>" or append -m "<path>"
          singleLine = singleLine.replace(/-m\s+"[^"]*"/, `-m "${override.model_path}"`);
          if (!singleLine.includes('-m')) {
            singleLine = `-m "${override.model_path}" ${singleLine}`;
          }
        }
        if (override.mmproj_path) {
          // Replace existing --mmproj "<path>" or append --mmproj "<path>"
          singleLine = singleLine.replace(/--mmproj\s+"[^"]*"/, `--mmproj "${override.mmproj_path}"`);
          if (!singleLine.includes('--mmproj')) {
            singleLine = `${singleLine} --mmproj "${override.mmproj_path}"`;
          }
        }
      }

      console.log('[PLAY] Spawning terminal with command:', singleLine);

      const sessionId = await invoke<string>('spawn_terminal', {
        configId: configLink.config_id,
        workingDir: installPath,
        startupCommand: singleLine || null,
      });

      setActiveTerminalId(sessionId);
      setTerminalVisible(true);
    } catch (err) {
      console.error('Failed to spawn terminal:', err);
      onError?.(`Failed to spawn terminal: ${String(err)}`);
    } finally {
      injectingRef.current = false;
    }
  }, [version, configLink, configs, override, setActiveTerminalId, setTerminalVisible, onError]);

  const hasConfig = configLink !== null;

  return {
    handlePlay,
    hasConfig,
  };
}
