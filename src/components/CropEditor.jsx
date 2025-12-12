import { useRef, useState, useEffect, useCallback } from 'react'

export default function CropEditor({
  frame,
  originalWidth,
  originalHeight,
  initialCrop,
  onSave,
  onCancel,
}) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [image, setImage] = useState(null)
  const [scale, setScale] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [selection, setSelection] = useState(
    initialCrop || { x: 0, y: 0, width: originalWidth, height: originalHeight }
  )

  // Load image
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      setImage(img)
      // Calculate scale to fit in container
      const container = containerRef.current
      if (container) {
        const maxWidth = container.clientWidth - 40
        const maxHeight = 400
        const scaleX = maxWidth / img.naturalWidth
        const scaleY = maxHeight / img.naturalHeight
        setScale(Math.min(scaleX, scaleY, 1))
      }
    }
    img.src = frame.url
  }, [frame.url])

  // Draw canvas
  useEffect(() => {
    if (!image || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    canvas.width = image.naturalWidth * scale
    canvas.height = image.naturalHeight * scale

    // Draw image
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    // Draw darkened overlay outside selection
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'

    // Top
    ctx.fillRect(0, 0, canvas.width, selection.y * scale)
    // Bottom
    ctx.fillRect(
      0,
      (selection.y + selection.height) * scale,
      canvas.width,
      canvas.height - (selection.y + selection.height) * scale
    )
    // Left
    ctx.fillRect(
      0,
      selection.y * scale,
      selection.x * scale,
      selection.height * scale
    )
    // Right
    ctx.fillRect(
      (selection.x + selection.width) * scale,
      selection.y * scale,
      canvas.width - (selection.x + selection.width) * scale,
      selection.height * scale
    )

    // Draw selection border
    ctx.strokeStyle = '#667eea'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.strokeRect(
      selection.x * scale,
      selection.y * scale,
      selection.width * scale,
      selection.height * scale
    )

    // Draw corner handles
    ctx.fillStyle = '#667eea'
    const handleSize = 8
    const corners = [
      { x: selection.x, y: selection.y },
      { x: selection.x + selection.width, y: selection.y },
      { x: selection.x, y: selection.y + selection.height },
      { x: selection.x + selection.width, y: selection.y + selection.height },
    ]
    corners.forEach((corner) => {
      ctx.fillRect(
        corner.x * scale - handleSize / 2,
        corner.y * scale - handleSize / 2,
        handleSize,
        handleSize
      )
    })
  }, [image, selection, scale])

  const getCanvasCoords = useCallback(
    (e) => {
      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      return {
        x: Math.round((e.clientX - rect.left) / scale),
        y: Math.round((e.clientY - rect.top) / scale),
      }
    },
    [scale]
  )

  const handleMouseDown = useCallback(
    (e) => {
      const coords = getCanvasCoords(e)
      setIsDragging(true)
      setDragStart(coords)
      setSelection({
        x: coords.x,
        y: coords.y,
        width: 0,
        height: 0,
      })
    },
    [getCanvasCoords]
  )

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging) return

      const coords = getCanvasCoords(e)
      const newSelection = {
        x: Math.min(dragStart.x, coords.x),
        y: Math.min(dragStart.y, coords.y),
        width: Math.abs(coords.x - dragStart.x),
        height: Math.abs(coords.y - dragStart.y),
      }

      // Clamp to image bounds
      newSelection.x = Math.max(0, newSelection.x)
      newSelection.y = Math.max(0, newSelection.y)
      newSelection.width = Math.min(
        newSelection.width,
        originalWidth - newSelection.x
      )
      newSelection.height = Math.min(
        newSelection.height,
        originalHeight - newSelection.y
      )

      setSelection(newSelection)
    },
    [isDragging, dragStart, getCanvasCoords, originalWidth, originalHeight]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleSave = () => {
    if (selection.width > 0 && selection.height > 0) {
      onSave(selection)
    }
  }

  const handleReset = () => {
    setSelection({ x: 0, y: 0, width: originalWidth, height: originalHeight })
  }

  return (
    <div className="crop-editor-overlay">
      <div className="crop-editor">
        <div className="crop-editor-header">
          <h3>Edit crop</h3>
          <button className="close-btn" onClick={onCancel}>
            ✕
          </button>
        </div>

        <div className="crop-editor-content" ref={containerRef}>
          <canvas
            ref={canvasRef}
            className="crop-canvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>

        <div className="crop-editor-info">
          <div className="crop-inputs">
            <label>
              X:
              <input
                type="number"
                value={selection.x}
                onChange={(e) =>
                  setSelection((s) => ({ ...s, x: parseInt(e.target.value) || 0 }))
                }
              />
            </label>
            <label>
              Y:
              <input
                type="number"
                value={selection.y}
                onChange={(e) =>
                  setSelection((s) => ({ ...s, y: parseInt(e.target.value) || 0 }))
                }
              />
            </label>
            <label>
              Width:
              <input
                type="number"
                value={selection.width}
                onChange={(e) =>
                  setSelection((s) => ({
                    ...s,
                    width: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </label>
            <label>
              Height:
              <input
                type="number"
                value={selection.height}
                onChange={(e) =>
                  setSelection((s) => ({
                    ...s,
                    height: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </label>
          </div>
        </div>

        <div className="crop-editor-actions">
          <button className="btn-secondary" onClick={handleReset}>
            Reset
          </button>
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave}>
            Save crop
          </button>
        </div>
      </div>
    </div>
  )
}
