/**
 * Global variables injected by the Tauri/Rust backend at startup.
 * These are set via initialization_script() before HTML is parsed.
 */
interface Window {
  /** Debug mode flag — true when built in debug mode */
  __DEV_MODE__?: boolean;
}
