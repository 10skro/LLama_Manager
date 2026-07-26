import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

// Global error handlers to catch silent crashes that freeze the UI
window.addEventListener('error', (event) => {
  console.error('[GlobalError]', event.error || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('[UnhandledRejection]', event.reason);
  event.preventDefault(); // Prevent Chrome from showing "A listener indicated an asynchronous error"
});

// Theme is already applied by the inline script in index.html (runs during HTML parsing,
// before any CSS/JS loads). No need to re-apply here — useTheme() in App.tsx handles
// reactive theme changes after React mount.

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
  // Theme is already applied by inline script in index.html from __INITIAL_THEME__
  const root = document.getElementById('root')!;
  (async () => {
    const { default: TerminalWidgetApp } = await import('./components/TerminalWidget/TerminalWidgetApp');
    ReactDOM.createRoot(root).render(<TerminalWidgetApp />);
  })();
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
