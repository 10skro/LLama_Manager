import { useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/store/useAppStore';
import type { InstalledVersion, CustomCommand, VersionConfigLink } from '@/types';

interface UseTerminalLaunchParams {
  version: InstalledVersion;
  configLink: VersionConfigLink | null;
  customCommands: CustomCommand[];
  onError?: (message: string) => void;
}

export function useTerminalLaunch({
  version,
  configLink,
  customCommands,
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
    const cmd = customCommands.find((c) => c.id === configLink.config_id);
    if (!cmd) {
      console.error('Custom command not found:', configLink.config_id);
      onError?.('Linked configuration not found. It may have been deleted.');
      return;
    }

    const startupCommand = cmd.command;

    // Only set injectingRef after validation passes
    injectingRef.current = true;

    try {
      const sessionId = await invoke<string>('spawn_terminal', {
        configId: configLink.config_id,
        workingDir: installPath,
      });

      setActiveTerminalId(sessionId);
      setTerminalVisible(true);

      // Inject startup commands after shell initializes
      if (startupCommand) {
        // Delay to let shell prompt appear (500ms for cmd)
        setTimeout(async () => {
          try {
            const lines = startupCommand.split(/\r?\n/);
            for (const line of lines) {
              await invoke('write_terminal_input', {
                sessionId,
                input: line + '\r\n',
              });
              // Small delay between lines for shell to process
              await new Promise((r) => setTimeout(r, 150));
            }
          } catch (err) {
            console.error('Failed to inject startup commands:', err);
          }
        }, 500);
      }
    } catch (err) {
      console.error('Failed to spawn terminal:', err);
      onError?.(`Failed to spawn terminal: ${String(err)}`);
    } finally {
      injectingRef.current = false;
    }
  }, [version, configLink, customCommands, setActiveTerminalId, setTerminalVisible, onError]);

  const hasConfig = configLink !== null;

  return {
    handlePlay,
    hasConfig,
  };
}
