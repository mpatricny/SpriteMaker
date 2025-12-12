import { useState } from 'react'
import CropEditor from './CropEditor'

export default function EditingStep({
  frames,
  selectedIds,
  originalWidth,
  originalHeight,
  onFramesUpdate,
  onRemoveBackground,
  onAutoCrop,
  onFlipHorizontal,
  isRemovingBackground,
  isAutoCropping,
  isFlipping,
  autoCropProgress,
  onBack,
  onNext,
}) {
  const [editingFrame, setEditingFrame] = useState(null)
  const [globalCrop, setGlobalCrop] = useState({ x: 0, y: 0, width: originalWidth, height: originalHeight })

  // Only show selected frames in editing step
  const selectedFrames = frames.filter((f) => selectedIds.includes(f.id))
  const hasCrop = selectedFrames.some((f) => f.cropRegion)

  const handleCropSave = (cropRegion) => {
    const updatedFrames = frames.map((frame) => {
      if (selectedIds.includes(frame.id)) {
        return { ...frame, cropRegion }
      }
      return frame
    })

    onFramesUpdate(updatedFrames)
    setEditingFrame(null)
    setGlobalCrop(cropRegion)
  }

  const handleApplyGlobalCrop = () => {
    if (globalCrop.width <= 0 || globalCrop.height <= 0) return

    const updatedFrames = frames.map((frame) => {
      if (selectedIds.includes(frame.id)) {
        return { ...frame, cropRegion: { ...globalCrop } }
      }
      return frame
    })
    onFramesUpdate(updatedFrames)
  }

  const handleResetCrop = () => {
    const updatedFrames = frames.map((frame) => {
      if (selectedIds.includes(frame.id)) {
        const { cropRegion, ...rest } = frame
        return rest
      }
      return frame
    })
    onFramesUpdate(updatedFrames)
    setGlobalCrop({ x: 0, y: 0, width: originalWidth, height: originalHeight })
  }

  return (
    <div className="editing-step">
      <div className="editing-toolbar">
        <button
          className="btn-secondary"
          onClick={onRemoveBackground}
          disabled={isRemovingBackground || isAutoCropping || isFlipping || selectedFrames.length === 0}
        >
          {isRemovingBackground ? 'Removing...' : 'Remove background'}
        </button>

        <button
          className="btn-secondary"
          onClick={onAutoCrop}
          disabled={isRemovingBackground || isAutoCropping || isFlipping || selectedFrames.length === 0}
        >
          {isAutoCropping ? `Auto-crop (${autoCropProgress}%)` : 'Auto-crop'}
        </button>

        <button
          className="btn-secondary"
          onClick={onFlipHorizontal}
          disabled={isRemovingBackground || isAutoCropping || isFlipping || selectedFrames.length === 0}
        >
          {isFlipping ? 'Flipping...' : '↔ Flip horizontal'}
        </button>

        <button
          className="btn-secondary"
          onClick={() => setEditingFrame(selectedFrames[0])}
          disabled={selectedFrames.length === 0}
        >
          Edit crop manually
        </button>

        {hasCrop && (
          <button className="btn-secondary" onClick={handleResetCrop}>
            Reset crop
          </button>
        )}
      </div>

      <div className="editing-info">
        <span>Editing {selectedFrames.length} frames</span>
      </div>

      <div className="editing-frames">
        {selectedFrames.map((frame) => (
          <div
            key={frame.id}
            className={`editing-frame selected ${frame.cropRegion ? 'has-crop' : ''}`}
            onClick={() => setEditingFrame(frame)}
          >
            <div className="frame-preview">
              {frame.cropRegion ? (
                <div
                  className="cropped-preview"
                  style={{
                    backgroundImage: `url(${frame.url})`,
                    backgroundPosition: `-${frame.cropRegion.x}px -${frame.cropRegion.y}px`,
                    width: frame.cropRegion.width,
                    height: frame.cropRegion.height,
                  }}
                />
              ) : (
                <img src={frame.url} alt={`Frame ${frame.index + 1}`} />
              )}
            </div>
            {frame.cropRegion && <span className="crop-badge">Crop</span>}
            <span className="frame-number">{frame.index + 1}</span>
          </div>
        ))}
      </div>

      <div className="global-crop-settings">
        <h4>Global crop</h4>
        <div className="crop-inputs-row">
          <label>
            X
            <input
              type="number"
              value={globalCrop.x}
              onChange={(e) => setGlobalCrop((c) => ({ ...c, x: parseInt(e.target.value) || 0 }))}
            />
          </label>
          <label>
            Y
            <input
              type="number"
              value={globalCrop.y}
              onChange={(e) => setGlobalCrop((c) => ({ ...c, y: parseInt(e.target.value) || 0 }))}
            />
          </label>
          <label>
            Width
            <input
              type="number"
              value={globalCrop.width}
              onChange={(e) => setGlobalCrop((c) => ({ ...c, width: parseInt(e.target.value) || 0 }))}
            />
          </label>
          <label>
            Height
            <input
              type="number"
              value={globalCrop.height}
              onChange={(e) => setGlobalCrop((c) => ({ ...c, height: parseInt(e.target.value) || 0 }))}
            />
          </label>
          <button className="btn-secondary" onClick={handleApplyGlobalCrop}>
            Apply to all
          </button>
        </div>
      </div>

      <div className="step-navigation">
        <button className="btn-secondary" onClick={onBack}>
          ← Back to selection
        </button>
        <button className="btn-primary" onClick={onNext}>
          Continue to export →
        </button>
      </div>

      {editingFrame && (
        <CropEditor
          frame={editingFrame}
          originalWidth={originalWidth}
          originalHeight={originalHeight}
          initialCrop={editingFrame.cropRegion || globalCrop}
          onSave={handleCropSave}
          onCancel={() => setEditingFrame(null)}
        />
      )}
    </div>
  )
}
