// GitHub build from llama.cpp
export interface Build {
  build_number: string;    // "b10075"
  tag_name: string;
  published_at: string;
  platform: string;        // "windows"
  architecture: string;    // "x64", "arm64"
  backend: string;         // "CPU", "CUDA_12_X", "Vulkan", etc.
  download_url: string;
  file_size: number;       // bytes
  checksum?: string;
}

// Installed version
export interface InstalledVersion {
  id: number;
  build_number: string;
  backend: string;
  architecture: string;
  install_path: string;
  installed_at: string;
  status: 'installed' | 'corrupt' | 'pending';
}

// Download tracking — kept for backend compatibility (DownloadRecord)
export interface Download {
  id: number;
  build_number: string;
  download_url: string;
  file_path?: string;
  total_size: number;
  downloaded_size: number;
  status: 'pending' | 'downloading' | 'downloaded' | 'extracting' | 'completed' | 'failed' | 'cancelled';
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// Download progress (real-time)
export interface DownloadProgress {
  download_id: number;
  build_number: string;
  downloaded: number;
  total: number;
  speed: number;           // bytes/sec
  percentage: number;
  eta_seconds: number;
  status: 'pending' | 'downloading' | 'downloaded' | 'extracting' | 'completed' | 'failed' | 'cancelled';
}

// App settings
export interface AppSettings {
  storage_path: string;
  theme: string; // Was: 'dark' | 'light' | 'system' - now flexible for named themes
  last_fetch?: string;
  auto_check_updates: boolean;
  toast_duration?: number; // milliseconds, default 5000
  font_family?: string; // CSS font-family name, e.g. 'Plus Jakarta Sans'
  model_folder?: string; // Folder containing .gguf model files
}

// Favorite build
export interface FavoriteBuild {
  id: number;
  build_number: string;
  backend: string;
  download_url: string;
}

// Filter state for catalog
export interface BuildFilters {
  search: string;
  backend: string[];
  architecture: string;
  sortBy: 'date' | 'build_number';
  sortOrder: 'asc' | 'desc';
  favoritesOnly: boolean;
  installedOnly: boolean;
}

// Launch configuration argument (ordered, references LlamaCppArg.flag)
export interface LaunchConfigArg {
  argKey: string;    // references LlamaCppArg.flag
  value: string;
}

// Full launch configuration
export interface LaunchConfig {
  id: string;
  name: string;
  shellType: 'cmd' | 'powershell';
  modelPath: string;
  args: LaunchConfigArg[];
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// Model file discovered by scanning
export interface ModelFile {
  path: string;
  name: string;
  size: number;
}
