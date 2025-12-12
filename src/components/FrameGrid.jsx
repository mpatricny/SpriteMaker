import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import FrameItem from './FrameItem'

export default function FrameGrid({
  frames,
  selectedIds,
  onFramesReorder,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onInvertSelection,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = frames.findIndex((f) => f.id === active.id)
      const newIndex = frames.findIndex((f) => f.id === over.id)
      onFramesReorder(arrayMove(frames, oldIndex, newIndex))
    }
  }

  return (
    <div className="frame-grid-container">
      <div className="frame-grid-toolbar">
        <button onClick={onSelectAll} className="toolbar-btn">
          Select all
        </button>
        <button onClick={onDeselectAll} className="toolbar-btn">
          Deselect all
        </button>
        <button onClick={onInvertSelection} className="toolbar-btn">
          Invert
        </button>
        <span className="selection-info">
          Selected: {selectedIds.length} / {frames.length}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={frames.map((f) => f.id)} strategy={rectSortingStrategy}>
          <div className="frame-grid">
            {frames.map((frame) => (
              <FrameItem
                key={frame.id}
                frame={frame}
                isSelected={selectedIds.includes(frame.id)}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
