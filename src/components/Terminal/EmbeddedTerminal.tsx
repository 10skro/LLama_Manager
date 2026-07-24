import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/store/useAppStore';
import '@xterm/xterm/css/xterm.css';

interface EmbeddedTerminalProps {
  sessionId: string;
  onClose: () => void;
}

// Default Catppuccin Mocha theme (used as fallback)
const DEFAULT_THEME = {
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

export function EmbeddedTerminal({ sessionId, onClose }: EmbeddedTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resetTerminal = useAppStore((state) => state.resetTerminal);

  // Write to terminal stdin via backend
  const writeInput = useCallback(
    (data: string) => {
      invoke('write_terminal_input', {
        sessionId,
        input: data,
      }).catch((err) => {
        console.error('Failed to write terminal input:', err);
      });
    },
    [sessionId]
  );

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: 'Cascadia Code, Consolas, "Courier New", monospace',
      rows: 20,
      cols: 80,
      allowProposedApi: true,
      theme: DEFAULT_THEME,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Fit terminal to container
    const fitTerminal = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    fitTerminal();

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitTerminal();
    });
    resizeObserver.observe(terminalRef.current);

    // Send user input to backend
    term.onData((data) => {
      writeInput(data);
    });

    // Listen for terminal output from backend
    const unlistenOutput = listen<{ sessionId: string; text: string }>('terminal-output', (event) => {
      if (event.payload.sessionId === sessionId && xtermRef.current) {
        // Use write() instead of writeln() to preserve raw output (ANSI sequences)
        xtermRef.current.write(event.payload.text);
      }
    });

    // Listen for terminal exit - reset store state when process exits
    const unlistenExit = listen<string>('terminal-exit', (event) => {
      if (event.payload === sessionId) {
        if (xtermRef.current) {
          xtermRef.current.write('\r\n[Process exited]\r\n');
        }
        // Reset store state so the panel hides automatically
        resetTerminal();
      }
    });

    return () => {
      resizeObserver.disconnect();
      unlistenOutput.then((u) => u());
      unlistenExit.then((u) => u());
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId, writeInput, resetTerminal]);

  // Kill terminal only on explicit close (not on visibility toggle)
  const handleClose = useCallback(() => {
    invoke('kill_terminal', { sessionId }).catch((err) => {
      console.error('Failed to kill terminal:', err);
    });
    resetTerminal();
    onClose();
  }, [sessionId, resetTerminal, onClose]);

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: DEFAULT_THEME.background }}>
      {/* Terminal header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-black/20">
        <span className="text-xs text-white/60 font-mono">Terminal</span>
        <button
          onClick={handleClose}
          className="text-xs text-white/40 hover:text-white/80 transition-colors"
          title="Close terminal"
          aria-label="Close terminal"
        >
          ✕
        </button>
      </div>
      {/* Terminal container */}
      <div ref={terminalRef} className="flex-1 p-1 overflow-hidden" />
    </div>
  );
}
