// Module unique de gestion des clés de build

// Clé composite stable pour matching installé/download/store
// Format: "build_number|backend|architecture"
export function makeKey(buildNumber: string, backend: string, architecture: string): string {
  return `${buildNumber}|${backend}|${architecture}`;
}

// Parse une clé composite
export function parseKey(key: string): {
  buildNumber: string;
  backend: string;
  architecture: string;
} {
  const parts = key.split('|');
  if (parts.length < 3) return { buildNumber: key, backend: '', architecture: 'x64' };
  return { buildNumber: parts[0], backend: parts[1], architecture: parts[2] };
}

// Clé unique pour React rendering et favorite matching
// Utilise download_url comme clé primaire (plus stable que build_number+backend)
export function getRowKey(build: {
  download_url: string;
  build_number: string;
  backend: string;
  architecture: string;
}): string {
  return build.download_url || makeKey(build.build_number, build.backend, build.architecture);
}
