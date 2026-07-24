import { useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/store/useAppStore';
import type { InstalledVersion, LaunchConfig, CustomCommand, VersionConfigLink } from '@/types';

interface UseTerminalLaunchParams {
  version: InstalledVersion;
  configLink: VersionConfigLink | null;
  launchConfigs: LaunchConfig[];
  customCommands: CustomCommand[];
  onError?: (message: string) => void;
}

/**
 * Escapes a value for CMD shell.
 */
function escapeCmdValue(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Escapes a value for PowerShell.
 */
function escapePsValue(value: string): string {
  const escaped = value.replace(/"/g, '`"');
  return `"${escaped}"`;
}

/**
 * Builds a shell launch command for llama-server.exe (mirrors buildLaunchCommand.ts).
 */
function buildLaunchCommand(
  exePath: string,
  modelPath: string,
  args: Array<{ argKey: string; value: string }>,
  shellType: 'cmd' | 'powershell'
): string {
  const isCmd = shellType === 'cmd';
  const continuation = isCmd ? '^' : '`';
  const escape = isCmd ? escapeCmdValue : escapePsValue;

  const lines: string[] = [];
  lines.push(`${escape(exePath)} ${continuation}`);
  lines.push(`-m ${escape(modelPath)} ${continuation}`);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const isLast = i === args.length - 1;

    if (!arg.value && arg.value !== 'true' && arg.value !== 'false') continue;
    if (arg.value === 'false') continue;

    if (isLast) {
      lines.push(arg.value === 'true' ? arg.argKey : `${arg.argKey} ${escape(arg.value)}`);
    } else {
      if (arg.value === 'true') {
        lines.push(`${arg.argKey} ${continuation}`);
      } else {
        lines.push(`${arg.argKey} ${escape(arg.value)} ${continuation}`);
      }
    }
  }

  return lines.join('\r\n');
}

export function useTerminalLaunch({
  version,
  configLink,
  launchConfigs,
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
    let startupCommand: string | null = null;
    let shellType: 'cmd' | 'powershell' = 'cmd';

    if (configLink.config_type === 'launch') {
      const config = launchConfigs.find((c) => c.id === configLink.config_id);
      if (!config) {
        console.error('Launch config not found:', configLink.config_id);
        onError?.('Linked configuration not found. It may have been deleted.');
        return;
      }

      const exePath = `${installPath}\\llama-server.exe`;
      startupCommand = buildLaunchCommand(exePath, config.modelPath, config.args, config.shellType);
      shellType = config.shellType;
    } else if (configLink.config_type === 'custom') {
      const cmd = customCommands.find((c) => c.id === configLink.config_id);
      if (!cmd) {
        console.error('Custom command not found:', configLink.config_id);
        onError?.('Linked configuration not found. It may have been deleted.');
        return;
      }

      startupCommand = cmd.command;
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
            const lines = startupCommand.split('\r\n');
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
  }, [version, configLink, launchConfigs, customCommands, setActiveTerminalId, setTerminalVisible, onError]);

  const hasConfig = configLink !== null;

  return {
    handlePlay,
    hasConfig,
  };
}
