import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import DragStateContext from './DragStateContext';

/**
 * Sortable wrapper for a VersionCard in reorder mode.
 * - Shows ghost placeholder on the dragged card.
 * - Shows animated pulse halo on the drop target.
 * - Smooth CSS transitions on sibling card position changes.
 * - Drag handle overlay (always visible during global drag, hover-only otherwise).
 */
export function SortableCardItem({
  versionId,
  children,
}: {
  versionId: number;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging, transform, transition } =
    useSortable({ id: versionId });
  const { overId, isDragging: isAnyDragging } = React.useContext(DragStateContext);

  const isDropTarget = overId === versionId && !isDragging;
  const isGhost = isDragging;

  // During drag: let DnD-kit control the dragged card's transform (pointer follow).
  // During settle: apply the computed transform with smooth transition.
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isGhost ? 0.3 : 1,
    zIndex: isDragging ? 10 : isDropTarget ? 5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group"
    >
      {/* Animated drop target indicator — glowing ring behind the card */}
      {isDropTarget && (
        <div className="absolute -inset-2 rounded-xl bg-secondary/50 ring-2 ring-ring/50 animate-pulse pointer-events-none" />
      )}

      {/* Ghost placeholder when this card is being dragged */}
      {isGhost && (
        <div className="absolute inset-0 rounded-xl border-2 border-dashed border-ring/30 bg-background/50 pointer-events-none" />
      )}

      {/* Drag handle overlay */}
      <div
        {...attributes}
        {...listeners}
        className={`absolute top-2 left-2 z-20 flex items-center justify-center w-8 h-8 rounded-md bg-background/80 backdrop-blur-sm border border-border/50 transition-opacity cursor-grab active:cursor-grabbing ${
          isAnyDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {children}
    </div>
  );
}
