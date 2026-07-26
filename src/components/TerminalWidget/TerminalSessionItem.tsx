import { useCallback, useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import '@xterm/xterm/css/xterm.css';
import { useAppStore } from '@/store/useAppStore';
import { getThemeById } from '@/themes';
import type { ITheme } from '@xterm/xterm';

interface TerminalSessionItemProps {
  sessionId: string;
  versionId: number;
  configId: string;
  onClose: (sessionId: string) => void;
}

/**
 * Map the app theme colors to an xterm.js theme.
 * Falls back to Catppuccin Mocha if the theme doesn't have the required colors.
 */
function mapToXtermTheme(themeId: string): ITheme {
  const theme = getThemeById(themeId);
  if (!theme) {
    return {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      cursor: '#f5e0dc',
      selectionBackground: '#585b7066',
      black: '#45475a',
      red: '#f38ba8',
      green: '#a6e3a1',
      yellow: '#f9e2af',
      blue: '#89b4fa',
      magenta: '#f5c2e7',
      cyan: '#94e2d5',
      white: '#bac2de',
      brightBlack: '#585b70',
      brightRed: '#f38ba8',
      brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af',
      brightBlue: '#89b4fa',
      brightMagenta: '#f5c2e7',
      brightCyan: '#94e2d5',
      brightWhite: '#a6adc8',
    };
  }

  const c = theme.colors;
  return {
    background: c.base,
    foreground: c.text,
    cursor: c.rosewater || '#f5e0dc',
    selectionBackground: (c.overlay0 || '#585b70') + '66',
    black: c.surface0 || '#45475a',
    red: c.red || '#f38ba8',
    green: c.green || '#a6e3a1',
    yellow: c.yellow || '#f9e2af',
    blue: c.blue || '#89b4fa',
    magenta: c.pink || '#f5c2e7',
    cyan: c.teal || '#94e2d5',
    white: c.overlay2 || '#bac2de',
    brightBlack: c.overlay0 || '#585b70',
    brightRed: c.red || '#f38ba8',
    brightGreen: c.green || '#a6e3a1',
    brightYellow: c.yellow || '#f9e2af',
    brightBlue: c.blue || '#89b4fa',
    brightMagenta: c.pink || '#f5c2e7',
    brightCyan: c.teal || '#94e2d5',
    brightWhite: c.overlay2 || '#a6adc8',
  };
}

export function TerminalSessionItem({ sessionId, onClose }: TerminalSessionItemProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const activeTheme = useAppStore((s) => s.activeTheme);

  // Theme update effect (in-place, preserves terminal buffer)
  useEffect(() => {
    if (!xtermRef.current) return;

    const xtermTheme = mapToXtermTheme(activeTheme);
    xtermRef.current.options.theme = xtermTheme;
    if (terminalRef.current) {
      terminalRef.current.style.backgroundColor = xtermTheme.background || '';
    }
  }, [activeTheme]);

  // Terminal initialization (runs once on mount)
  useEffect(() => {
    if (!terminalRef.current) return;

    const xtermTheme = mapToXtermTheme(activeTheme);

    terminalRef.current.style.backgroundColor = xtermTheme.background || '';

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 12,
      fontFamily: 'Cascadia Code, Consolas, "Courier New", monospace',
      rows: 20,
      cols: 80,
      allowProposedApi: true,
      theme: xtermTheme,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const fitTerminal = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    fitTerminal();

    const resizeObserver = new ResizeObserver(() => {
      fitTerminal();
    });
    resizeObserver.observe(terminalRef.current);

    invoke<string>('get_terminal_buffer', { sessionId })
      .then((buffer) => {
        if (buffer && xtermRef.current) {
          xtermRef.current.write(buffer);
        }
      })
      .catch(() => {});

    const unlistenDebug = listen<string>('terminal-debug', (event) => {
      console.log(event.payload);
    });

    const unlistenOutput = listen<{ sessionId: string; text: string }>('terminal-output', (event) => {
      if (event.payload.sessionId === sessionId && xtermRef.current) {
        xtermRef.current.write(event.payload.text);
      }
    });

    const unlistenExit = listen<string>('terminal-exit', (event) => {
      if (event.payload === sessionId && xtermRef.current) {
        xtermRef.current.write('\r\n[Process exited]\r\n');
      }
    });

    return () => {
      resizeObserver.disconnect();
      unlistenDebug.then((u) => u());
      unlistenOutput.then((u) => u());
      unlistenExit.then((u) => u());
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId]);

  const handleClose = useCallback(() => {
    invoke('kill_terminal', { sessionId }).catch((err) => {
      console.error('Failed to kill terminal:', err);
    });
    onClose(sessionId);
  }, [sessionId, onClose]);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30">
        <span className="text-xs text-foreground/60 font-mono truncate">{sessionId.slice(0, 8)}</span>
        <button
          onClick={handleClose}
          className="text-xs text-foreground/40 hover:text-foreground/80 transition-colors"
          title="Kill terminal"
          aria-label="Kill terminal"
        >
          ✕
        </button>
      </div>
      <div ref={terminalRef} className="flex-1 p-1 overflow-hidden min-h-0" />
    </div>
  );
}
