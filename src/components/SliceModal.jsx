import { useState, useRef, useEffect, useCallback } from 'react'

export default function SliceModal({ onImport, onClose }) {
  const [image, setImage] = useState(null)
  const [columns, setColumns] = useState(4)
  const [rows, setRows] = useState(4)
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const fileInputRef = useRef(null)
  const [scale, setScale] = useState(1)

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return

    const img = new Image()
    img.onload = () => {
      setImage(img)
      const container = containerRef.current
      if (container) {
        const maxWidth = container.clientWidth - 40
        const maxHeight = 400
        const scaleX = maxWidth / img.naturalWidth
        const scaleY = maxHeight / img.naturalHeight
        setScale(Math.min(scaleX, scaleY, 1))
      }
    }
    img.src = URL.createObjectURL(file)
  }

  // Draw preview with grid
  useEffect(() => {
    if (!image || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    canvas.width = image.naturalWidth * scale
    canvas.height = image.naturalHeight * scale

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    // Draw grid lines
    ctx.strokeStyle = 'rgba(102, 126, 234, 0.7)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])

    const cellW = canvas.width / columns
    const cellH = canvas.height / rows

    for (let c = 1; c < columns; c++) {
      ctx.beginPath()
      ctx.moveTo(c * cellW, 0)
      ctx.lineTo(c * cellW, canvas.height)
      ctx.stroke()
    }
    for (let r = 1; r < rows; r++) {
      ctx.beginPath()
      ctx.moveTo(0, r * cellH)
      ctx.lineTo(canvas.width, r * cellH)
      ctx.stroke()
    }
  }, [image, columns, rows, scale])

  const handleImport = useCallback(() => {
    if (!image) return

    const frameWidth = Math.floor(image.naturalWidth / columns)
    const frameHeight = Math.floor(image.naturalHeight / rows)
    const items = []

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const offscreen = document.createElement('canvas')
        offscreen.width = frameWidth
        offscreen.height = frameHeight
        const ctx = offscreen.getContext('2d')
        ctx.drawImage(
          image,
          c * frameWidth, r * frameHeight, frameWidth, frameHeight,
          0, 0, frameWidth, frameHeight
        )
        offscreen.toBlob((blob) => {
          if (!blob) return
          const url = URL.createObjectURL(blob)
          items.push({
            id: `slice-${Date.now()}-${r}-${c}`,
            url,
            x: c * frameWidth,
            y: r * frameHeight,
            width: frameWidth,
            height: frameHeight,
            naturalWidth: frameWidth,
            naturalHeight: frameHeight,
            selected: false,
          })
          if (items.length === rows * columns) {
            onImport(items)
          }
        }, 'image/png')
      }
    }
  }, [image, columns, rows, onImport])

  return (
    <div className="crop-editor-overlay">
      <div className="crop-editor slice-modal">
        <div className="crop-editor-header">
          <h3>Import Spritesheet</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="crop-editor-content" ref={containerRef}>
          {!image ? (
            <div className="slice-upload-area" onClick={() => fileInputRef.current?.click()}>
              <p>Click to select a spritesheet image</p>
              <p className="upload-subtext">PNG, JPG, or WebP</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>
          ) : (
            <canvas ref={canvasRef} style={{ display: 'block' }} />
          )}
        </div>

        {image && (
          <div className="crop-editor-info">
            <div className="slice-settings">
              <label>
                Columns:
                <input
                  type="number"
                  min="1"
                  max="64"
                  value={columns}
                  onChange={(e) => setColumns(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </label>
              <label>
                Rows:
                <input
                  type="number"
                  min="1"
                  max="64"
                  value={rows}
                  onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </label>
              <span className="slice-info-text">
                Cell: {Math.floor(image.naturalWidth / columns)} x {Math.floor(image.naturalHeight / rows)} px
              </span>
            </div>
          </div>
        )}

        <div className="crop-editor-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={handleImport}
            disabled={!image}
          >
            Import cells
          </button>
        </div>
      </div>
    </div>
  )
}
