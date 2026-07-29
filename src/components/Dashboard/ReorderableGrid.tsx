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
  arrayMove,
} from '@dnd-kit/sortable';
import { useEffect, useState } from 'react';
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
  onDragEnd: (versions: InstalledVersion[]) => void;
  actions: VersionCardActions;
}

export function ReorderableGrid({ versions, onDragEnd, actions }: ReorderableGridProps) {
  const [localVersions, setLocalVersions] = useState(versions);

  useEffect(() => {
    setLocalVersions(versions);
  }, [versions]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: {
    active: { id: UniqueIdentifier };
    over: { id: UniqueIdentifier } | null;
  }) => {
    const over = event.over;
    if (!over) return;

    const activeIdx = localVersions.findIndex((v) => v.id === event.active.id);
    const overIdx = localVersions.findIndex((v) => v.id === over.id);
    if (activeIdx === -1 || overIdx === -1 || activeIdx === overIdx) return;

    const newVersions = arrayMove(localVersions, activeIdx, overIdx);
    setLocalVersions(newVersions);
    onDragEnd(newVersions);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={localVersions.map((v) => v.id)} strategy={rectSortingStrategy}>
        <DragStateProvider>
          <div className={GRID_CLASS}>
            {localVersions.map((version) => (
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
