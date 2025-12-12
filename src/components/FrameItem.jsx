import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export default function FrameItem({ frame, isSelected, onToggleSelect }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: frame.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`frame-item ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
    >
      <div className="frame-drag-handle" {...attributes} {...listeners}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="2" />
          <circle cx="15" cy="6" r="2" />
          <circle cx="9" cy="12" r="2" />
          <circle cx="15" cy="12" r="2" />
          <circle cx="9" cy="18" r="2" />
          <circle cx="15" cy="18" r="2" />
        </svg>
      </div>
      <img src={frame.url} alt={`Frame ${frame.index + 1}`} />
      <label className="frame-checkbox">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(frame.id)}
        />
        <span className="checkmark"></span>
      </label>
      <span className="frame-number">{frame.index + 1}</span>
    </div>
  )
}
