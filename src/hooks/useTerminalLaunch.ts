import { useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/store/useAppStore';
import { buildLaunchCommand } from '@/utils/buildLaunchCommand';
import type { InstalledVersion, LaunchConfig, CustomCommand, VersionConfigLink, VersionOverride, LaunchConfigArg } from '@/types';

interface UseTerminalLaunchParams {
  version: InstalledVersion;
  configLink: VersionConfigLink | null;
  launchConfigs: LaunchConfig[];
  customCommands: CustomCommand[];
  override?: VersionOverride | null;
  onError?: (message: string) => void;
}

export function useTerminalLaunch({
  version,
  configLink,
  launchConfigs,
  customCommands,
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
    let startupCommand: string | null = null;
    let shellType: 'cmd' | 'powershell' = 'cmd';

    if (configLink.config_type === 'launch') {
      const config = launchConfigs.find((c) => c.id === configLink.config_id);
      if (!config) {
        console.error('Launch config not found:', configLink.config_id);
        onError?.('Linked configuration not found. It may have been deleted.');
        return;
      }

      // Apply override: replace model path and mmproj path from config
      let modelPath = config.modelPath;
      let args: LaunchConfigArg[] = config.args;

      if (override) {
        if (override.model_path) {
          modelPath = override.model_path;
        }
        if (override.mmproj_path) {
          // Replace existing --mmproj arg or add new one
          const mmprojIndex = args.findIndex(a => a.argKey === '--mmproj');
          if (mmprojIndex >= 0) {
            args = args.map((a, i) =>
              i === mmprojIndex ? { ...a, value: override.mmproj_path! } : a
            );
          } else {
            args = [...args, { argKey: '--mmproj', value: override.mmproj_path }];
          }
        }
      }

      const exePath = `${installPath}\\llama-server.exe`;
      startupCommand = buildLaunchCommand(exePath, modelPath, args, config.shellType);
      shellType = config.shellType;
    } else if (configLink.config_type === 'custom') {
      const cmd = customCommands.find((c) => c.id === configLink.config_id);
      if (!cmd) {
        console.error('Custom command not found:', configLink.config_id);
        onError?.('Linked configuration not found. It may have been deleted.');
        return;
      }

      startupCommand = cmd.command;
      shellType = cmd.shellType || 'cmd';
    } else {
      onError?.('Unknown configuration type. Cannot launch.');
      return;
    }

    // Only set injectingRef after validation passes
    injectingRef.current = true;

    try {
      const sessionId = await invoke<string>('spawn_terminal', {
        configId: configLink.config_id,
        shellType,
        workingDir: installPath,
      });

      setActiveTerminalId(sessionId);
      setTerminalVisible(true);

      // Inject startup commands after shell initializes
      if (startupCommand) {
        // Delay to let shell prompt appear (1000ms for PowerShell, 500ms for cmd)
        const initialDelay = shellType.toLowerCase() === 'powershell' ? 1000 : 500;

        setTimeout(async () => {
          try {
            // For cmd, each line needs \r\n. For PowerShell, use \r\n too.
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
        }, initialDelay);
      }
    } catch (err) {
      console.error('Failed to spawn terminal:', err);
    } finally {
      injectingRef.current = false;
    }
  }, [version, configLink, launchConfigs, customCommands, override, setActiveTerminalId, setTerminalVisible, onError]);

  const hasConfig = configLink !== null;

  return {
    handlePlay,
    hasConfig,
  };
}
