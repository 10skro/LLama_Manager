const backendColors: Record<string, string> = {
  'CPU': 'bg-surface-1/50 text-lavender border-lavender/30',
  'CUDA': 'bg-surface-1/50 text-green border-green/30',
  'Vulkan': 'bg-surface-1/50 text-peach border-peach/30',
  'Metal': 'bg-surface-1/50 text-overlay-2 border-overlay-2/30',
};

export function getBackendColor(backend: string): string {
  for (const [key, color] of Object.entries(backendColors)) {
    if (backend.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return 'bg-surface-1/50 text-overlay-2 border-overlay-2/30';
}
