import { useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/store/useAppStore';
import { emit, listen } from '@tauri-apps/api/event';
import type { InstalledVersion, ConfigEntry, VersionConfigLink, VersionOverride } from '@/types';
import { useServerStatus } from './useServerStatus';

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
  const updateTerminalStatus = useAppStore((state) => state.updateTerminalStatus);
  const clearTerminalSession = useAppStore((state) => state.clearTerminalSession);
  const injectingRef = useRef(false);

  // Reactive session selector — drives re-renders when session/status changes.
  // This is the single source of truth for both the button toggle and the server-ready effect.
  const session = useAppStore((state) => state.terminalSessions[version.id]);

  // IMPORTANT: Hook must be called unconditionally (Rules of Hooks)
  useServerStatus(version.id);

  // Button toggle: any active terminal session (including error) shows Stop.
  // An error session still has a live terminal instance — the error status is
  // informational only (server failed to start), so the user must Stop first
  // to kill the zombie process before playing again.
  const hasSession = !!session;

  // Server-ready detection: transition 'starting' → 'running' when llama_server
  // outputs "listening on". Falls back to 'error' after 60s timeout.
  // Key fix: this effect depends on `session` (reactive selector), so it re-runs
  // whenever the session is created or its status changes — not just at mount.
  useEffect(() => {
    if (!session || session.status !== 'starting') {
      return;
    }

    const sessionId = session.sessionId;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let unlistenOutput: (() => void) | null = null;

    listen<{ sessionId: string; text: string }>('terminal-output', (event) => {
      const current = useAppStore.getState().terminalSessions[version.id];
      if (!current || current.sessionId !== sessionId) return;
      if (current.status !== 'starting') return;

      if (/listening on/i.test(event.payload.text)) {
        updateTerminalStatus(version.id, 'running', sessionId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      }
    })
      .then((u) => {
        unlistenOutput = u;
      })
      .catch(() => {});

    // Timeout: if server doesn't output "listening on" within 60s, mark as error
    timeoutId = setTimeout(() => {
      const current = useAppStore.getState().terminalSessions[version.id];
      if (current && current.sessionId === sessionId && current.status === 'starting') {
        updateTerminalStatus(version.id, 'error', sessionId);
      }
    }, 60_000);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (unlistenOutput) unlistenOutput();
    };
  }, [version.id, session, updateTerminalStatus]);
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

      // Track this terminal by version_id (not config_id!) so multiple cards
      // sharing the same config can run independently. Start in 'starting' status;
      // a separate useEffect listens for "listening on" in terminal-output to
      // transition to 'running', with a 60s timeout fallback to 'error'.
      updateTerminalStatus(version.id, 'starting', sessionId);

      // Notify floating terminal window of session changes
      emit('terminal-sessions-update', null).catch(() => {});
    } catch (err) {
      onError?.(`Failed to spawn terminal: ${String(err)}`);
    } finally {
      injectingRef.current = false;
    }
  }, [version, configLink, configs, override, updateTerminalStatus, onError]);

  const handleStop = useCallback(async () => {
    if (!configLink || injectingRef.current) return;
    const current = useAppStore.getState().terminalSessions[version.id];
    if (!current) return;

    injectingRef.current = true;
    try {
      updateTerminalStatus(version.id, 'stopping', current.sessionId);

      // kill_terminal emits terminal-exit with reason="killed", so AppShell
      // will clean up the session without showing an error badge.

      // Kill is async (non-blocking) — returns immediately, taskkill runs on a blocking thread.
      // A "terminal-exit" event is emitted when the process tree is confirmed dead.
      await invoke<string>('kill_terminal', {
        sessionId: current.sessionId,
      });

      // Notify floating terminal window of session changes
      emit('terminal-sessions-update', null).catch(() => {});
    } catch (_err) {
      // Process may already be dead (user closed terminal via X button).
      // In that case, just clean up the session silently — no error toast needed.
      clearTerminalSession(version.id);
      emit('terminal-sessions-update', null).catch(() => {});
    } finally {
      injectingRef.current = false;
    }
  }, [configLink, version.id, updateTerminalStatus, clearTerminalSession]);

  // Toggle: any active session → stop, no session → play.
  // Error sessions still have a live terminal instance, so Stop kills the
  // zombie process. The user must explicitly Stop before playing again.
  const handleToggle = useCallback(async () => {
    if (!configLink || injectingRef.current) return;
    const current = useAppStore.getState().terminalSessions[version.id];
    if (current) {
      await handleStop();
    } else {
      await handlePlay();
    }
  }, [configLink, handlePlay, handleStop, version.id]);

  const hasConfig = configLink !== null;

  return {
    handleToggle,
    hasSession,
    hasConfig,
  };
}
