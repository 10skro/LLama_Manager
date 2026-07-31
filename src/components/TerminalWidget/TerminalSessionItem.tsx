import { useCallback, useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/store/useAppStore';
import { getThemeById } from '@/themes';
import type { ITheme } from '@xterm/xterm';

interface TerminalSessionItemProps {
  sessionId: string;
  versionId: number;
  configId: string;
  cardTitle: string;
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

export function TerminalSessionItem({ sessionId, cardTitle, onClose }: TerminalSessionItemProps) {
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

    // Read theme directly from store to avoid re-initializing the terminal
    // on every theme change (the separate theme-updating effect handles that).
    const currentTheme = useAppStore.getState().activeTheme;
    const xtermTheme = mapToXtermTheme(currentTheme);
    terminalRef.current.style.backgroundColor = xtermTheme.background || '';

    let resources: ReturnType<typeof initTerminal> = null;
    let isMounted = true; // Protects against rapid unmounts

    const initTerminal = () => {
      if (!isMounted) return null;

      const container = terminalRef.current;
      if (!container) return null;

      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'bar',
        fontSize: 12,
        fontFamily:
          'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        lineHeight: 1.2,
        allowProposedApi: true,
        theme: xtermTheme,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      // Wait for the Flexbox layout to finish before opening the terminal.
      // In production builds, JS executes faster than DOM layout, so the container
      // may still be 0px tall when useEffect fires. requestAnimationFrame guarantees
      // the browser has painted the frame and assigned real dimensions.
      const waitForLayout = () => {
        if (!isMounted) return;

        if (container.clientHeight === 0 || container.clientWidth === 0) {
          requestAnimationFrame(waitForLayout);
          return;
        }

        term.open(container);
        fitAddon.fit();
      };

      requestAnimationFrame(waitForLayout);

      const resizeObserver = new ResizeObserver(() => {
        if (fitAddonRef.current && container.clientHeight > 0) {
          fitAddonRef.current.fit();
        }
      });
      resizeObserver.observe(container);

      invoke<string>('get_terminal_buffer', { sessionId })
        .then((buffer) => {
          if (buffer && xtermRef.current) {
            xtermRef.current.write(buffer);
          }
        })
        .catch(() => {});

      const unlistenOutput = listen<{ sessionId: string; text: string }>(
        'terminal-output',
        (event) => {
          if (event.payload.sessionId === sessionId && xtermRef.current) {
            xtermRef.current.write(event.payload.text);
          }
        }
      );

      const unlistenExit = listen<string>('terminal-exit', (event) => {
        if (event.payload === sessionId && xtermRef.current) {
          xtermRef.current.write('\r\n[Process exited]\r\n');
        }
      });

      return { term, resizeObserver, unlistenOutput, unlistenExit };
    };

    // 1. FORCE FONT LOADING HERE
    const fontToLoad = '12px "JetBrains Mono"';

    if (document.fonts && document.fonts.load) {
      document.fonts
        .load(fontToLoad)
        .then(() => {
          resources = initTerminal();
        })
        .catch(() => {
          // Immediate fallback if the network or font blocks
          resources = initTerminal();
        });
    } else {
      resources = initTerminal();
    }

    return () => {
      isMounted = false; // Blocks initTerminal if the promise isn't resolved yet
      if (!resources) return;

      resources.resizeObserver.disconnect();
      resources.unlistenOutput.then((u) => u());
      resources.unlistenExit.then((u) => u());
      resources.term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId]);

  const handleClose = useCallback(() => {
    // Delegate to parent (TerminalWidget.handleClose) which sets 'stopping' status
    // before killing. This avoids double-killing and ensures the main app's
    // terminal-exit handler sees 'stopping' → clean removal (no error badge).
    onClose(sessionId);
  }, [sessionId, onClose]);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30">
        <span className="text-xs text-foreground/60 font-mono truncate">
          {sessionId.slice(0, 8)}
        </span>
        {cardTitle && (
          <span className="text-xs text-foreground/40 truncate ml-2">— {cardTitle}</span>
        )}
        <button
          onClick={handleClose}
          className="text-xs text-foreground/40 hover:text-foreground/80 transition-colors"
          title="Kill terminal"
          aria-label="Kill terminal"
        >
          ✕
        </button>
      </div>
      <div ref={terminalRef} className="flex-1 overflow-hidden min-h-0" />
    </div>
  );
}
