// Single module for build key management

// Stable composite key for installed/download/store matching
// Format: "build_number|backend|architecture"
export function makeKey(buildNumber: string, backend: string, architecture: string): string {
  return `${buildNumber}|${backend}|${architecture}`;
}

// Parse a composite key
export function parseKey(key: string): {
  buildNumber: string;
  backend: string;
  architecture: string;
} {
  const parts = key.split('|');
  if (parts.length < 3) return { buildNumber: key, backend: '', architecture: 'x64' };
  return { buildNumber: parts[0], backend: parts[1], architecture: parts[2] };
}

// Unique key for React rendering and favorite matching
// Uses download_url as primary key (more stable than build_number+backend)
export function getRowKey(build: {
  download_url: string;
  build_number: string;
  backend: string;
  architecture: string;
}): string {
  return build.download_url || makeKey(build.build_number, build.backend, build.architecture);
}
