import { useMemo } from 'react';
import { useInstalledVersions } from '@/hooks/useInstalledVersions';
import { useBuilds } from './useBuilds';

interface BuildInfo {
  build_number: string;
  build_num: number;
}

interface LatestBuildInfo {
  latestInstalled: BuildInfo | null;
  latestAvailable: BuildInfo | null;
  updateAvailable: boolean;
}

/**
 * Parses a build number like "b10106" into a numeric value.
 */
function parseBuildNumber(build_number: string): number {
  const num = build_number.trimStart().replace(/^b/i, '');
  return parseInt(num, 10) || 0;
}

/**
 * Find the entry with the highest numeric build number from a list.
 */
function findHighestBuild<T extends { build_number: string }>(
  items: T[] | undefined
): BuildInfo | null {
  if (!items || items.length === 0) return null;

  let best: BuildInfo | null = null;
  for (const item of items) {
    const num = parseBuildNumber(item.build_number);
    if (!best || num > best.build_num) {
      best = { build_number: item.build_number, build_num: num };
    }
  }
  return best;
}

/**
 * Combines installed versions and available builds to determine:
 * - The numerically highest installed build
 * - The numerically highest available build on GitHub
 * - Whether an update is available
 *
 * Both underlying queries run in parallel (no waterfall).
 */
export function useLatestBuildInfo(): LatestBuildInfo {
  const { data: installedVersions } = useInstalledVersions();
  const { data: availableBuilds } = useBuilds();

  return useMemo(() => {
    const latestInstalled = findHighestBuild(installedVersions);
    const latestAvailable = findHighestBuild(availableBuilds);

    const updateAvailable =
      latestInstalled !== null &&
      latestAvailable !== null &&
      latestAvailable.build_num > latestInstalled.build_num;

    return {
      latestInstalled,
      latestAvailable,
      updateAvailable,
    };
  }, [installedVersions, availableBuilds]);
}
