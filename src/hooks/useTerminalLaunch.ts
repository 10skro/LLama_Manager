import { useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore, useGetRunningSessionId, useGetStoppingSessionId } from '@/store/useAppStore';
import { emit, listen } from '@tauri-apps/api/event';
import type { InstalledVersion, ConfigEntry, VersionConfigLink, VersionOverride } from '@/types';

/**
 * Replace or inject a flag (-m or --mmproj) in a command line string.
 * Handles paths with double quotes, single quotes, or no quotes.
 * Preserves all other arguments untouched.
 *
 * IMPORTANT: Does NOT wrap the new value in quotes.
 * When the command is executed via `cmd /K "full command"`, any quotes
 * inside the command string become literal characters in the arguments
 * received by the target process. This causes "Invalid argument" errors
 * because the OS tries to open a file whose name starts with `"`.
 *
 * Strategy: tokenise the command respecting quoted strings,
 * then replace the flag+value pair if found, otherwise insert
 * RIGHT AFTER the executable (first token ending with .exe or similar).
 */
function applyOverrideFlag(
  cmd: string,
  flag: string, // e.g. '-m' or '--mmproj'
  newValue: string // the override path (no quotes added)
): string {
  // Tokenise: split on whitespace but respect quoted strings
  const tokens: string[] = [];
  const re = /"[^"]*"|'[^']*'|\S+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cmd)) !== null) {
    tokens.push(match[0]);
  }

  // Find the index of the flag token (exact match, case-sensitive)
  const flagIdx = tokens.findIndex((t) => {
    const bare = t.replace(/^["']/, '').replace(/["']$/, '');
    return bare === flag;
  });

  if (flagIdx >= 0) {
    // Replace the flag AND its value (next token, or the value is attached like -m"path")
    // Case A: flag and value are separate tokens:  -m "path"
    // Case B: flag and value are attached:         -m"path"
    if (flagIdx < tokens.length && tokens[flagIdx].length > flag.length) {
      // Case B: attached, e.g. -m"path" — replace just the flag token
      // No quotes around newValue to prevent literal quote characters in args
      tokens[flagIdx] = `${flag} ${newValue}`;
    } else if (flagIdx + 1 < tokens.length) {
      // Case A: separate — replace flag and value tokens
      tokens[flagIdx] = flag;
      // No quotes around newValue
      tokens[flagIdx + 1] = newValue;
    } else {
      // Flag at end with no value — replace and append new value
      tokens[flagIdx] = flag;
      tokens.push(newValue);
    }
    return tokens.join(' ');
  }

  // Flag not found — insert RIGHT AFTER the executable (first token)
  // This ensures:  exe.exe -m path --other-args ...
  const injection = `${flag} ${newValue}`;
  if (tokens.length === 0) {
    return injection;
  }
  tokens.splice(1, 0, injection);
  return tokens.join(' ');
}

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
  const setRunningTerminal = useAppStore((state) => state.setRunningTerminal);
  const removeRunningTerminal = useAppStore((state) => state.removeRunningTerminal);
  const setStoppingTerminal = useAppStore((state) => state.setStoppingTerminal);
  const removeStoppingTerminal = useAppStore((state) => state.removeStoppingTerminal);
  const injectingRef = useRef(false);

  // Check if this version's terminal is currently running
  // IMPORTANT: Hook must be called unconditionally (Rules of Hooks)
  // Tracking by version_id so multiple cards with the SAME config can run independently
  const runningSessionId = useGetRunningSessionId(version.id);
  const stoppingSessionId = useGetStoppingSessionId(version.id);
  const isRunning = !!runningSessionId && configLink !== null;
  const isStopping = !!stoppingSessionId;

  // Listen for terminal-exit events to clear stopping state
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<string>('terminal-exit', (event) => {
      // Check if this exit event matches a stopping terminal for this version
      const currentStoppingId = useAppStore.getState().stoppingTerminals[version.id];
      if (currentStoppingId === event.payload) {
        removeStoppingTerminal(version.id);
      }
    })
      .then((u) => {
        unlisten = u;
      })
      .catch(() => {});

    return () => {
      if (unlisten) unlisten();
    };
  }, [version.id, removeStoppingTerminal]);

  const handlePlay = useCallback(async () => {
    // Guard: no config link or already injecting
    if (!configLink || injectingRef.current) return;

    const installPath = version.install_path;

    // Validate config exists BEFORE setting injectingRef
    const config = configs.find(
      (c) => c.type === configLink.config_type && c.id === configLink.config_id
    );

    if (!config) {
      console.error('[LAUNCH] ERROR: Linked configuration not found!');
      console.error(
        '[LAUNCH] Looking for type="' +
          configLink.config_type +
          '" id="' +
          configLink.config_id +
          '"'
      );
      console.error(
        '[LAUNCH] Available config IDs:',
        configs.map((c) => c.id)
      );
      onError?.('Linked configuration not found. It may have been deleted.');
      return;
    }

    const startupCommand = config.command;

    // Auto-prepend llama-server.exe if command doesn't already start with an executable
    const needsPrefix =
      startupCommand &&
      !startupCommand.trim().startsWith('llama-server') &&
      !startupCommand.trim().startsWith('.\\') &&
      !startupCommand.trim().startsWith('..\\');
    const fullCommand = needsPrefix ? `llama-server.exe ${startupCommand}` : startupCommand;

    // Only set injectingRef after validation passes
    injectingRef.current = true;

    try {
      // Join all lines into one: remove ^ and newlines, replace with spaces
      let singleLine = (fullCommand || '')
        .split(/\r?\n/)
        .map((line) => line.replace(/\s*\^\s*$/, '').trim())
        .filter((line) => line.length > 0)
        .join(' ');

      // Inject override model_path and mmproj_path if present
      // Uses robust token-based replacement that handles quoted/unquoted paths
      if (override) {
        if (override.model_path) {
          singleLine = applyOverrideFlag(singleLine, '-m', override.model_path);
        }
        if (override.mmproj_path) {
          singleLine = applyOverrideFlag(singleLine, '--mmproj', override.mmproj_path);
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
      // Notify floating terminal window of session changes
      emit('terminal-sessions-update', null).catch(() => {});
    } catch (err) {
      onError?.(`Failed to spawn terminal: ${String(err)}`);
    } finally {
      injectingRef.current = false;
    }
  }, [version, configLink, configs, override, setRunningTerminal, onError]);

  const handleStop = useCallback(async () => {
    if (!configLink || injectingRef.current) return;
    // Read current state at call time to avoid stale closure
    // Track by version_id so each card is independent
    const sessionId = useAppStore.getState().runningTerminals[version.id];
    if (!sessionId) return;

    injectingRef.current = true;
    try {
      // Immediately move from running → stopping (UI shows "Stopping...")
      removeRunningTerminal(version.id);
      setStoppingTerminal(version.id, sessionId);

      // Kill is async (non-blocking) — returns immediately, taskkill runs on a blocking thread.
      // A "terminal-exit" event is emitted when the process tree is confirmed dead.
      await invoke<string>('kill_terminal', {
        sessionId: sessionId,
      });

      // Notify floating terminal window of session changes
      emit('terminal-sessions-update', null).catch(() => {});
    } catch (err) {
      onError?.(`Failed to stop server: ${String(err)}`);
      // On error, clear stopping state so the UI recovers
      removeStoppingTerminal(version.id);
    } finally {
      injectingRef.current = false;
    }
  }, [
    configLink,
    onError,
    version.id,
    removeRunningTerminal,
    setStoppingTerminal,
    removeStoppingTerminal,
  ]);

  // Toggle: if running → stop, else → start
  // Read current state at call time to avoid stale closure issues
  const handleToggle = useCallback(async () => {
    if (!configLink || injectingRef.current) return;
    // Track by version_id so each card is independent
    const currentSessionId = useAppStore.getState().runningTerminals[version.id];
    if (currentSessionId) {
      // Currently running → stop (reuse handleStop for consistent stopping flow)
      await handleStop();
    } else {
      // Not running → play (reuse handlePlay)
      await handlePlay();
    }
  }, [configLink, handlePlay, handleStop, version.id]);

  const hasConfig = configLink !== null;

  return {
    handlePlay,
    handleStop,
    handleToggle,
    isRunning,
    isStopping,
    hasConfig,
  };
}
