import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { applyTheme, getThemeById, DEFAULT_THEME_ID } from './themes';
import './index.css';

// Global error handlers to catch silent crashes that freeze the UI
window.addEventListener('error', (event) => {
  console.error('[GlobalError]', event.error || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('[UnhandledRejection]', event.reason);
  event.preventDefault(); // Prevent Chrome from showing "A listener indicated an asynchronous error"
});

// Hydrate theme from Rust-injected __INITIAL_THEME__ (set via initialization_script)
// This runs BEFORE React renders, preventing white flash
const initialTheme = (window as any).__INITIAL_THEME__;
if (initialTheme) {
  const theme = getThemeById(initialTheme.name);
  if (theme) {
    applyTheme(theme);
  }
} else {
  // Fallback: apply default theme if no theme was injected
  const defaultTheme = getThemeById(DEFAULT_THEME_ID);
  if (defaultTheme) {
    applyTheme(defaultTheme);
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

// Detect if this is the floating terminal window
const isTerminalWindow = new URLSearchParams(window.location.search).get('window') === 'terminal';

if (isTerminalWindow) {
  // Render the terminal widget app (no router, no query provider needed)
  // Theme is already applied above from __INITIAL_THEME__
  const root = document.getElementById('root')!;
  const renderTerminalApp = async () => {
    const { default: TerminalWidgetApp } = await import('./components/TerminalWidget/TerminalWidgetApp');
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <TerminalWidgetApp />
      </React.StrictMode>,
    );
  };
  renderTerminalApp();
} else {
  // Render the main application
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
