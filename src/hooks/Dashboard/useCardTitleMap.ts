import { useState, useEffect, useRef, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCardCustomizations } from '@/services/version';

export function useCardTitleMap() {
  const [titleMap, setTitleMap] = useState<Record<number, string>>({});
  const cancelledRef = useRef(false);

  const loadTitles = useCallback(() => {
    getCardCustomizations()
      .then((cards) => {
        if (cancelledRef.current) return;
        const map: Record<number, string> = {};
        cards.forEach((card) => {
          map[card.version_id] = card.title;
        });
        setTitleMap(map);
      })
      .catch((err) => {
        console.error('Failed to load card titles:', err);
      });
  }, []);

  useEffect(() => {
    cancelledRef.current = false;

    // Initial load
    loadTitles();

    // Listen for card customization changes from the main window
    const unlisten = listen('card-customizations-update', () => {
      loadTitles();
    });

    return () => {
      cancelledRef.current = true;
      unlisten.then((u) => u());
    };
  }, [loadTitles]);

  return titleMap;
}
