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

// Apply default theme immediately before React renders
const defaultTheme = getThemeById(DEFAULT_THEME_ID);
if (defaultTheme) {
  applyTheme(defaultTheme);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
