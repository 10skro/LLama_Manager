import { useState, useEffect, useCallback, useRef } from 'react';
import { getVersionConfigLink, saveVersionConfigLink, deleteVersionConfigLink } from '@/services/versionConfig';
import type { VersionConfigLink } from '@/types';

export function useVersionConfigLinks() {
  const [links, setLinks] = useState<Record<number, VersionConfigLink>>({});
  const [isLoading, setIsLoading] = useState(true);
  const cancelledRef = useRef(false);

  const loadAll = useCallback(async (versionIds: number[]) => {
    cancelledRef.current = false;
    setIsLoading(true);
    try {
      const results: Record<number, VersionConfigLink> = {};
      await Promise.all(
        versionIds.map(async (id) => {
          const link = await getVersionConfigLink(id).catch(() => null);
          if (cancelledRef.current) return;
          if (link) {
            results[id] = link;
          }
        })
      );
      if (!cancelledRef.current) {
        setLinks(results);
      }
    } catch (err) {
      console.error('Failed to load version config links:', err);
    } finally {
      if (!cancelledRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    return () => { cancelledRef.current = true; };
  }, []);

  const getLink = useCallback((versionId: number) => {
    return links[versionId] ?? null;
  }, [links]);

  const setLink = useCallback(async (versionId: number, configType: 'launch' | 'custom', configId: string) => {
    try {
      await saveVersionConfigLink(versionId, configType, configId);
      setLinks(prev => ({
        ...prev,
        [versionId]: { version_id: versionId, config_type: configType, config_id: configId },
      }));
    } catch (err) {
      console.error('Failed to save version config link:', err);
    }
  }, []);

  const removeLink = useCallback(async (versionId: number) => {
    try {
      await deleteVersionConfigLink(versionId);
      setLinks(prev => {
        const next = { ...prev };
        delete next[versionId];
        return next;
      });
    } catch (err) {
      console.error('Failed to remove version config link:', err);
    }
  }, []);

  return {
    links,
    isLoading,
    getLink,
    setLink,
    removeLink,
    loadAll,
  };
}
