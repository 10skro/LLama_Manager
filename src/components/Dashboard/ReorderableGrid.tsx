import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { UniqueIdentifier } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableCardItem } from './SortableCardItem';
import { DragStateProvider } from './DragStateContext';
import { VersionCard } from './VersionCard';
import type { InstalledVersion } from '@/types';

interface ReorderableGridProps {
  versions: InstalledVersion[];
  reorderMode: boolean;
  onDragEnd: (event: { active: { id: UniqueIdentifier }; over: { id: UniqueIdentifier } | null }) => void;
  onDeleteClick: (versionId: number) => void;
  onDuplicateClick: (versionId: number, withSettings: boolean) => void;
  onCopyClick: (versionId: number) => void;
  onPasteRequest: (targetVersionId: number) => void;
}

export function ReorderableGrid({
  versions,
  reorderMode,
  onDragEnd,
  onDeleteClick,
  onDuplicateClick,
  onCopyClick,
  onPasteRequest,
}: ReorderableGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const cardProps = {
    onDeleteClick,
    onDuplicateClick,
    onCopyClick,
    onPasteRequest,
  };

  if (!reorderMode) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {versions.map((version) => (
          <VersionCard key={version.id} version={version} {...cardProps} />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={versions.map((v) => v.id)}
        strategy={rectSortingStrategy}
      >
        <DragStateProvider>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {versions.map((version) => (
              <SortableCardItem key={version.id} versionId={version.id}>
                <VersionCard version={version} {...cardProps} />
              </SortableCardItem>
            ))}
          </div>
        </DragStateProvider>
      </SortableContext>
    </DndContext>
  );
}
