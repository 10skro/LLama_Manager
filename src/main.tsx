import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

// THEME-BOOT diagnostic: mark CSS load completion
console.log('[THEME-BOOT] ② CSS loaded, bg from computed:', getComputedStyle(document.documentElement).getPropertyValue('--background').trim());

// Global error handlers to catch silent crashes that freeze the UI
window.addEventListener('error', (event) => {
  console.error('[GlobalError]', event.error || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('[UnhandledRejection]', event.reason);
  event.preventDefault(); // Prevent Chrome from showing "A listener indicated an asynchronous error"
});

// Theme is applied reactively by useTheme() after React mounts.
// The WebView background_color prevents flash before HTML paints.

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
  // Theme is applied by useTheme() hook after React mounts
  const root = document.getElementById('root')!;
  (async () => {
    console.log('[THEME-BOOT] ③ React mount (terminal)');
    const { default: TerminalWidgetApp } =
      await import('./components/TerminalWidget/TerminalWidgetApp');
    ReactDOM.createRoot(root).render(<TerminalWidgetApp />);
  })();
} else {
  // Render the main application
  console.log('[THEME-BOOT] ③ React mount (main)');
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>
  );
}
