import { useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore, useGetRunningSessionId } from '@/store/useAppStore';
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
  const setRunningTerminal = useAppStore((state) => state.setRunningTerminal);
  const injectingRef = useRef(false);

  // Check if this version's terminal is currently running
  // IMPORTANT: Hook must be called unconditionally (Rules of Hooks)
  // Tracking by version_id so multiple cards with the SAME config can run independently
  const runningSessionId = useGetRunningSessionId(version.id);
  const isRunning = !!runningSessionId && configLink !== null;

  const handlePlay = useCallback(async () => {
    // Guard: no config link or already injecting
    if (!configLink || injectingRef.current) return;

    const installPath = version.install_path;

    // Validate config exists BEFORE setting injectingRef
    const config = configs.find((c) => c.type === configLink.config_type && c.id === configLink.config_id);
    if (!config) {
      onError?.('Linked configuration not found. It may have been deleted.');
      return;
    }

    const startupCommand = config.command;
    // Auto-prepend llama-server.exe if command doesn't already start with an executable
    const needsPrefix = startupCommand && !startupCommand.trim().startsWith('llama-server') && !startupCommand.trim().startsWith('.\\') && !startupCommand.trim().startsWith('..\\');
    const fullCommand = needsPrefix
      ? `llama-server.exe ${startupCommand}`
      : startupCommand;

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

      const sessionId = await invoke<string>('spawn_terminal', {
        configId: configLink.config_id,
        versionId: version.id,
        workingDir: installPath,
        startupCommand: singleLine || null,
      });

      // Track this running terminal by version_id (not config_id!)
      // so multiple cards sharing the same config can run independently
      setRunningTerminal(version.id, sessionId);
      setActiveTerminalId(sessionId);
      setTerminalVisible(true);
    } catch (err) {
      onError?.(`Failed to spawn terminal: ${String(err)}`);
    } finally {
      injectingRef.current = false;
    }
  }, [version, configLink, configs, override, setActiveTerminalId, setTerminalVisible, setRunningTerminal, onError]);

  const handleStop = useCallback(async () => {
    if (!configLink || injectingRef.current) return;
    // Read current state at call time to avoid stale closure
    // Track by version_id so each card is independent
    const sessionId = useAppStore.getState().runningTerminals[version.id];
    if (!sessionId) return;

    injectingRef.current = true;
    try {
      await invoke<string>('kill_terminal', {
        sessionId: sessionId,
      });

      // Remove from running terminals tracking by version_id
      useAppStore.getState().removeRunningTerminal(version.id);

      // If the killed session was the active terminal, reset the panel
      const currentActive = useAppStore.getState().activeTerminalId;
      if (currentActive === sessionId) {
        useAppStore.getState().resetTerminal();
      }
    } catch (err) {
      onError?.(`Failed to stop server: ${String(err)}`);
    } finally {
      injectingRef.current = false;
    }
  }, [configLink, onError]);

  // Toggle: if running → stop, else → start
  // Read current state at call time to avoid stale closure issues
  const handleToggle = useCallback(async () => {
    if (!configLink || injectingRef.current) return;
    // Track by version_id so each card is independent
    const currentSessionId = useAppStore.getState().runningTerminals[version.id];
    if (currentSessionId) {
      // Currently running → stop
      injectingRef.current = true;
      try {
        await invoke<string>('kill_terminal', {
          sessionId: currentSessionId,
        });
        useAppStore.getState().removeRunningTerminal(version.id);
        const activeId = useAppStore.getState().activeTerminalId;
        if (activeId === currentSessionId) {
          useAppStore.getState().resetTerminal();
        }
      } catch (err) {
        onError?.(`Failed to stop server: ${String(err)}`);
      } finally {
        injectingRef.current = false;
      }
    } else {
      // Not running → play (reuse handlePlay)
      await handlePlay();
    }
  }, [configLink, handlePlay, onError]);

  const hasConfig = configLink !== null;

  return {
    handlePlay,
    handleStop,
    handleToggle,
    isRunning,
    hasConfig,
  };
}
