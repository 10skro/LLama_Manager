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

const GRID_CLASS = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';

/* ─── Actions passed from DashboardPage to VersionCard ─── */

export interface VersionCardActions {
  onDeleteClick: (versionId: number) => void;
  onDuplicateClick: (versionId: number, withSettings: boolean) => void;
  onCopyClick: (versionId: number) => void;
  onPasteRequest: (targetVersionId: number) => void;
}

interface ReorderableGridProps {
  versions: InstalledVersion[];
  reorderMode: boolean;
  onDragEnd: (event: { active: { id: UniqueIdentifier }; over: { id: UniqueIdentifier } | null }) => void;
  actions: VersionCardActions;
}

export function ReorderableGrid({
  versions,
  reorderMode,
  onDragEnd,
  actions,
}: ReorderableGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!reorderMode) {
    return (
      <div className={GRID_CLASS}>
        {versions.map((version) => (
          <VersionCard key={version.id} version={version} actions={actions} />
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
          <div className={GRID_CLASS}>
            {versions.map((version) => (
              <SortableCardItem key={version.id} versionId={version.id}>
                <VersionCard version={version} actions={actions} />
              </SortableCardItem>
            ))}
          </div>
        </DragStateProvider>
      </SortableContext>
    </DndContext>
  );
}
