import { useState, useEffect, useMemo, useRef } from 'react';
import { getCustomCommands } from '@/services/customCommand';
import type { ConfigEntry, CustomCommand } from '@/types';

export type ConfigFilter = 'all' | 'custom';

export function useConfigs() {
  const [entries, setEntries] = useState<ConfigEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ConfigFilter>('all');
  const cancelledRef = useRef(false);

  const load = async () => {
    cancelledRef.current = false;
    setIsLoading(true);
    try {
      const customCommands = await getCustomCommands().catch(() => [] as CustomCommand[]);
      if (cancelledRef.current) return;

      const merged: ConfigEntry[] = customCommands.map((cc) => ({
        type: 'custom' as const,
        id: cc.id,
        name: cc.name,
        description: cc.description,
        color: cc.color,
        createdAt: cc.createdAt,
        updatedAt: cc.updatedAt,
        command: cc.command,
      }));

      // Sort by updatedAt descending
      merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setEntries(merged);
    } catch (err) {
      console.error('Failed to load configs:', err);
    } finally {
      if (!cancelledRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const filtered = useMemo(() => {
    let result = entries;

    // Type filter
    if (filter !== 'all') {
      result = result.filter((e) => e.type === filter);
    }

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (e) => e.name.toLowerCase().includes(q) || (e.description ?? '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [entries, filter, search]);

  return {
    entries: filtered,
    allEntries: entries,
    isLoading,
    search,
    setSearch,
    filter,
    setFilter,
    totalCount: filtered.length,
    refetch: load,
  };
}
