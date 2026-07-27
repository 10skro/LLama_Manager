import { useState, useEffect, useRef } from 'react';
import { getCardCustomizations } from '@/services/version';

export function useCardTitleMap() {
  const [titleMap, setTitleMap] = useState<Record<number, string>>({});
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
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

    return () => { cancelledRef.current = true; };
  }, []);

  return titleMap;
}
