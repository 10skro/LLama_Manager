/**
 * Global variables injected by the Tauri/Rust backend at startup.
 * These are set via initialization_script() before HTML is parsed.
 */
interface Window {
  /** Theme injected by backend — { name: string, bg: string, fg: string } */
  __INITIAL_THEME__?: {
    name: string;
    bg: string;
    fg: string;
  };
  /** Debug mode flag — true when built in debug mode */
  __DEV_MODE__?: boolean;
}
