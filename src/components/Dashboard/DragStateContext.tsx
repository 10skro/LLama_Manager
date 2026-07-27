import React from 'react';
import { useDndContext } from '@dnd-kit/core';

export interface DragState {
  overId: number | undefined;
  isDragging: boolean;
}

export const DragStateContext = React.createContext<DragState>({
  overId: undefined,
  isDragging: false,
});

export function DragStateProvider({ children }: { children: React.ReactNode }) {
  const { active, over } = useDndContext();
  const state: DragState = {
    overId: over?.id as number | undefined,
    isDragging: !!active,
  };

  return (
    <DragStateContext.Provider value={state}>
      {children}
    </DragStateContext.Provider>
  );
}
