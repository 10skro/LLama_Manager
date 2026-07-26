/**
 * Dev mode banner — only visible when the app was built in debug mode.
 * Reads `window.__DEV_MODE__` injected by the Rust backend at startup.
 */

export function DevBanner() {
  const isDev = (window as any).__DEV_MODE__ === true;

  if (!isDev) {
    return null;
  }

  return (
    <div
      role="banner"
      className="bg-yellow-500/15 border-b border-yellow-500/30 text-yellow-500 text-center text-xs font-medium py-1 select-none"
    >
      ⚠ DEV BUILD — Vous êtes sur une version de développement
    </div>
  );
}
