import { useState, useRef, useEffect, useCallback } from 'react'
import SliceModal from './SliceModal'
import { createHistory, pushState, undo, redo, canUndo, canRedo } from '../utils/composerHistory'
import { downloadBlob } from '../utils/spriteGenerator'

const HANDLE_SIZE = 8

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

export default function SpritesheetComposer({ onBack }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const fileInputRef = useRef(null)
  const bgInputRef = useRef(null)

  const [canvasWidth, setCanvasWidth] = useState(512)
  const [canvasHeight, setCanvasHeight] = useState(512)
  const [cellWidth, setCellWidth] = useState(64)
  const [cellHeight, setCellHeight] = useState(64)
  const [showGrid, setShowGrid] = useState(true)

  const [backgroundImage, setBackgroundImage] = useState(null)
  const [backgroundUrl, setBackgroundUrl] = useState(null)
  // Offscreen canvas for mutable background pixels (region select erases from this)
  const bgCanvasRef = useRef(null)

  const [items, setItems] = useState([])
  const [activeTool, setActiveTool] = useState('move')
  const [showSliceModal, setShowSliceModal] = useState(false)

  const [history, setHistory] = useState(() => createHistory([]))

  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [dragType, setDragType] = useState(null) // 'move' | 'resize' | 'marquee' | 'regionSelect'
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [marqueeRect, setMarqueeRect] = useState(null)
  const [regionRect, setRegionRect] = useState(null)
  const [resizeHandle, setResizeHandle] = useState(null) // which corner
  const [resizeItemId, setResizeItemId] = useState(null)
  const [lockAspect, setLockAspect] = useState(false)

  // Image cache for drawing
  const imageCacheRef = useRef({})

  const [scale, setScale] = useState(1)

  // Compute scale to fit canvas in container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const maxW = container.clientWidth - 20
    const maxH = 600
    const s = Math.min(maxW / canvasWidth, maxH / canvasHeight, 1)
    setScale(s)
  }, [canvasWidth, canvasHeight])

  // Preload item images into cache
  useEffect(() => {
    items.forEach((item) => {
      if (!imageCacheRef.current[item.url]) {
        const img = new Image()
        img.onload = () => {
          imageCacheRef.current[item.url] = img
          drawCanvas()
        }
        img.src = item.url
      }
    })
  }, [items])

  // Sync items with history present
  useEffect(() => {
    setItems(history.present)
  }, [history])

  const pushHistory = useCallback((newItems) => {
    setHistory((h) => pushState(h, newItems))
  }, [])

  const handleUndo = useCallback(() => {
    setHistory((h) => undo(h))
  }, [])

  const handleRedo = useCallback(() => {
    setHistory((h) => redo(h))
  }, [])

  // Canvas coordinate transform
  const getCanvasCoords = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    }
  }, [scale])

  // Hit test: find item at position (top-most first)
  const hitTest = useCallback((x, y) => {
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i]
      if (x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height) {
        return item
      }
    }
    return null
  }, [items])

  // Hit test resize handles on selected items
  const hitTestHandle = useCallback((x, y) => {
    const selected = items.filter((it) => it.selected)
    for (let i = selected.length - 1; i >= 0; i--) {
      const item = selected[i]
      const hs = HANDLE_SIZE / scale
      const corners = [
        { name: 'tl', cx: item.x, cy: item.y },
        { name: 'tr', cx: item.x + item.width, cy: item.y },
        { name: 'bl', cx: item.x, cy: item.y + item.height },
        { name: 'br', cx: item.x + item.width, cy: item.y + item.height },
      ]
      for (const c of corners) {
        if (Math.abs(x - c.cx) <= hs && Math.abs(y - c.cy) <= hs) {
          return { handle: c.name, itemId: item.id }
        }
      }
    }
    return null
  }, [items, scale])

  // --- Mouse handlers ---
  const handleMouseDown = useCallback((e) => {
    const coords = getCanvasCoords(e)

    if (activeTool === 'regionSelect') {
      setIsDragging(true)
      setDragType('regionSelect')
      setDragStart(coords)
      setRegionRect({ x: coords.x, y: coords.y, w: 0, h: 0 })
      return
    }

    // Check resize handles first
    const handleHit = hitTestHandle(coords.x, coords.y)
    if (handleHit) {
      setIsDragging(true)
      setDragType('resize')
      setResizeHandle(handleHit.handle)
      setResizeItemId(handleHit.itemId)
      setDragStart(coords)
      return
    }

    const hit = hitTest(coords.x, coords.y)

    if (hit) {
      if (e.shiftKey) {
        // Toggle selection
        const newItems = items.map((it) =>
          it.id === hit.id ? { ...it, selected: !it.selected } : it
        )
        pushHistory(newItems)
      } else if (!hit.selected) {
        // Select only this one
        const newItems = items.map((it) => ({ ...it, selected: it.id === hit.id }))
        pushHistory(newItems)
      }
      // Start drag move
      setIsDragging(true)
      setDragType('move')
      setDragStart(coords)
      setDragOffset({ x: coords.x, y: coords.y })
    } else {
      // Click on empty — deselect all or start marquee
      if (!e.shiftKey) {
        const newItems = items.map((it) => ({ ...it, selected: false }))
        pushHistory(newItems)
      }
      setIsDragging(true)
      setDragType('marquee')
      setDragStart(coords)
      setMarqueeRect({ x: coords.x, y: coords.y, w: 0, h: 0 })
    }
  }, [getCanvasCoords, activeTool, hitTest, hitTestHandle, items, pushHistory])

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return
    const coords = getCanvasCoords(e)

    if (dragType === 'move') {
      const dx = coords.x - dragOffset.x
      const dy = coords.y - dragOffset.y
      if (dx === 0 && dy === 0) return
      setItems((prev) =>
        prev.map((it) =>
          it.selected ? { ...it, x: Math.round(it.x + dx), y: Math.round(it.y + dy) } : it
        )
      )
      setDragOffset({ x: coords.x, y: coords.y })
    } else if (dragType === 'marquee') {
      setMarqueeRect({
        x: Math.min(dragStart.x, coords.x),
        y: Math.min(dragStart.y, coords.y),
        w: Math.abs(coords.x - dragStart.x),
        h: Math.abs(coords.y - dragStart.y),
      })
    } else if (dragType === 'regionSelect') {
      setRegionRect({
        x: Math.min(dragStart.x, coords.x),
        y: Math.min(dragStart.y, coords.y),
        w: Math.abs(coords.x - dragStart.x),
        h: Math.abs(coords.y - dragStart.y),
      })
    } else if (dragType === 'resize') {
      const item = items.find((it) => it.id === resizeItemId)
      if (!item) return

      let newX = item.x, newY = item.y, newW = item.width, newH = item.height

      if (resizeHandle === 'br') {
        newW = Math.max(8, coords.x - item.x)
        newH = Math.max(8, coords.y - item.y)
      } else if (resizeHandle === 'bl') {
        newW = Math.max(8, (item.x + item.width) - coords.x)
        newH = Math.max(8, coords.y - item.y)
        newX = coords.x
      } else if (resizeHandle === 'tr') {
        newW = Math.max(8, coords.x - item.x)
        newH = Math.max(8, (item.y + item.height) - coords.y)
        newY = coords.y
      } else if (resizeHandle === 'tl') {
        newW = Math.max(8, (item.x + item.width) - coords.x)
        newH = Math.max(8, (item.y + item.height) - coords.y)
        newX = coords.x
        newY = coords.y
      }

      if (lockAspect && item.naturalWidth && item.naturalHeight) {
        const aspect = item.naturalWidth / item.naturalHeight
        if (newW / newH > aspect) {
          newW = newH * aspect
        } else {
          newH = newW / aspect
        }
      }

      setItems((prev) =>
        prev.map((it) =>
          it.id === resizeItemId
            ? { ...it, x: Math.round(newX), y: Math.round(newY), width: Math.round(newW), height: Math.round(newH) }
            : it
        )
      )
    }
  }, [isDragging, dragType, getCanvasCoords, dragStart, dragOffset, resizeHandle, resizeItemId, items, lockAspect])

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return

    if (dragType === 'marquee' && marqueeRect) {
      // Select items within marquee
      const r = marqueeRect
      const newItems = items.map((it) => {
        const intersects =
          it.x < r.x + r.w && it.x + it.width > r.x &&
          it.y < r.y + r.h && it.y + it.height > r.y
        return { ...it, selected: intersects }
      })
      pushHistory(newItems)
    } else if (dragType === 'regionSelect' && regionRect && bgCanvasRef.current) {
      // Cut region from background and create new item
      const r = regionRect
      if (r.w > 2 && r.h > 2) {
        const rx = Math.round(Math.max(0, r.x))
        const ry = Math.round(Math.max(0, r.y))
        const rw = Math.round(Math.min(r.w, canvasWidth - rx))
        const rh = Math.round(Math.min(r.h, canvasHeight - ry))

        const bgCanvas = bgCanvasRef.current
        const bgCtx = bgCanvas.getContext('2d')

        // Extract pixel data from the region
        const regionData = bgCtx.getImageData(rx, ry, rw, rh)

        // Clear the region on the background canvas
        bgCtx.clearRect(rx, ry, rw, rh)

        // Create a new item from the extracted region
        const offscreen = document.createElement('canvas')
        offscreen.width = rw
        offscreen.height = rh
        const offCtx = offscreen.getContext('2d')
        offCtx.putImageData(regionData, 0, 0)

        offscreen.toBlob((blob) => {
          if (!blob) return
          const url = URL.createObjectURL(blob)
          const newItem = {
            id: `region-${Date.now()}`,
            url,
            x: rx,
            y: ry,
            width: rw,
            height: rh,
            naturalWidth: rw,
            naturalHeight: rh,
            selected: true,
          }
          const newItems = items.map((it) => ({ ...it, selected: false }))
          newItems.push(newItem)
          pushHistory(newItems)
          setActiveTool('move')
        }, 'image/png')
      }
    } else if (dragType === 'move' || dragType === 'resize') {
      // Commit move/resize to history
      pushHistory([...items])
    }

    setIsDragging(false)
    setDragType(null)
    setMarqueeRect(null)
    setRegionRect(null)
    setResizeHandle(null)
    setResizeItemId(null)
  }, [isDragging, dragType, marqueeRect, regionRect, items, pushHistory, canvasWidth, canvasHeight])

  // --- Draw ---
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    canvas.width = canvasWidth * scale
    canvas.height = canvasHeight * scale
    ctx.scale(scale, scale)

    // Checkerboard background
    const tileSize = 16
    for (let y = 0; y < canvasHeight; y += tileSize) {
      for (let x = 0; x < canvasWidth; x += tileSize) {
        const isLight = ((x / tileSize) + (y / tileSize)) % 2 === 0
        ctx.fillStyle = isLight ? '#2a2a3e' : '#333347'
        ctx.fillRect(x, y, tileSize, tileSize)
      }
    }

    // Draw background image from mutable canvas
    if (bgCanvasRef.current) {
      ctx.drawImage(bgCanvasRef.current, 0, 0, canvasWidth, canvasHeight)
    }

    // Draw grid
    if (showGrid && cellWidth > 0 && cellHeight > 0) {
      ctx.strokeStyle = 'rgba(102, 126, 234, 0.25)'
      ctx.lineWidth = 1 / scale
      ctx.setLineDash([2 / scale, 2 / scale])
      for (let x = cellWidth; x < canvasWidth; x += cellWidth) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvasHeight)
        ctx.stroke()
      }
      for (let y = cellHeight; y < canvasHeight; y += cellHeight) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvasWidth, y)
        ctx.stroke()
      }
      ctx.setLineDash([])
    }

    // Draw items
    items.forEach((item) => {
      const img = imageCacheRef.current[item.url]
      if (img) {
        ctx.drawImage(img, item.x, item.y, item.width, item.height)
      }

      if (item.selected) {
        ctx.strokeStyle = '#667eea'
        ctx.lineWidth = 2 / scale
        ctx.setLineDash([4 / scale, 4 / scale])
        ctx.strokeRect(item.x, item.y, item.width, item.height)
        ctx.setLineDash([])

        // Resize handles
        const hs = HANDLE_SIZE / scale
        ctx.fillStyle = '#667eea'
        const corners = [
          { x: item.x, y: item.y },
          { x: item.x + item.width, y: item.y },
          { x: item.x, y: item.y + item.height },
          { x: item.x + item.width, y: item.y + item.height },
        ]
        corners.forEach((c) => {
          ctx.fillRect(c.x - hs / 2, c.y - hs / 2, hs, hs)
        })
      }
    })

    // Draw marquee
    if (marqueeRect) {
      ctx.strokeStyle = '#667eea'
      ctx.lineWidth = 1 / scale
      ctx.setLineDash([4 / scale, 4 / scale])
      ctx.strokeRect(marqueeRect.x, marqueeRect.y, marqueeRect.w, marqueeRect.h)
      ctx.fillStyle = 'rgba(102, 126, 234, 0.1)'
      ctx.fillRect(marqueeRect.x, marqueeRect.y, marqueeRect.w, marqueeRect.h)
      ctx.setLineDash([])
    }

    // Draw region select rect
    if (regionRect) {
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 2 / scale
      ctx.setLineDash([4 / scale, 4 / scale])
      ctx.strokeRect(regionRect.x, regionRect.y, regionRect.w, regionRect.h)
      ctx.fillStyle = 'rgba(245, 158, 11, 0.15)'
      ctx.fillRect(regionRect.x, regionRect.y, regionRect.w, regionRect.h)
      ctx.setLineDash([])
    }
  }, [canvasWidth, canvasHeight, scale, showGrid, cellWidth, cellHeight, items, marqueeRect, regionRect])

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  // --- Background loading ---
  const handleLoadBackground = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setBackgroundImage(img)
      setBackgroundUrl(url)
      setCanvasWidth(img.naturalWidth)
      setCanvasHeight(img.naturalHeight)

      // Create mutable background canvas
      const bgCanvas = document.createElement('canvas')
      bgCanvas.width = img.naturalWidth
      bgCanvas.height = img.naturalHeight
      const bgCtx = bgCanvas.getContext('2d')
      bgCtx.drawImage(img, 0, 0)
      bgCanvasRef.current = bgCanvas
    }
    img.src = url
    e.target.value = ''
  }, [])

  // --- Import images ---
  const handleImportImages = useCallback((e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const newItems = []
    let loaded = 0

    files.forEach((file, i) => {
      if (!file.type.startsWith('image/')) return
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        newItems.push({
          id: `img-${Date.now()}-${i}`,
          url,
          x: (i % 8) * 68,
          y: Math.floor(i / 8) * 68,
          width: img.naturalWidth,
          height: img.naturalHeight,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          selected: false,
        })
        loaded++
        if (loaded === files.length) {
          pushHistory([...items, ...newItems])
        }
      }
      img.src = url
    })
    e.target.value = ''
  }, [items, pushHistory])

  // --- Slice import ---
  const handleSliceImport = useCallback((slicedItems) => {
    pushHistory([...items, ...slicedItems])
    setShowSliceModal(false)
  }, [items, pushHistory])

  // --- Delete selected ---
  const deleteSelected = useCallback(() => {
    const newItems = items.filter((it) => !it.selected)
    if (newItems.length !== items.length) {
      pushHistory(newItems)
    }
  }, [items, pushHistory])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement?.tagName === 'INPUT') return
        e.preventDefault()
        deleteSelected()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo, handleRedo, deleteSelected])

  // --- Alignment ---
  const selectedItems = items.filter((it) => it.selected)

  const alignItems = useCallback((type) => {
    const sel = items.filter((it) => it.selected)
    if (sel.length === 0) return

    let newItems = [...items]
    const bounds = {
      left: Math.min(...sel.map((it) => it.x)),
      right: Math.max(...sel.map((it) => it.x + it.width)),
      top: Math.min(...sel.map((it) => it.y)),
      bottom: Math.max(...sel.map((it) => it.y + it.height)),
    }

    if (type === 'left') {
      newItems = newItems.map((it) => it.selected ? { ...it, x: bounds.left } : it)
    } else if (type === 'right') {
      newItems = newItems.map((it) => it.selected ? { ...it, x: bounds.right - it.width } : it)
    } else if (type === 'top') {
      newItems = newItems.map((it) => it.selected ? { ...it, y: bounds.top } : it)
    } else if (type === 'bottom') {
      newItems = newItems.map((it) => it.selected ? { ...it, y: bounds.bottom - it.height } : it)
    } else if (type === 'centerH') {
      // Center each item horizontally within nearest grid cell
      newItems = newItems.map((it) => {
        if (!it.selected) return it
        const cellX = Math.round(it.x / cellWidth) * cellWidth
        return { ...it, x: cellX + Math.round((cellWidth - it.width) / 2) }
      })
    } else if (type === 'centerV') {
      newItems = newItems.map((it) => {
        if (!it.selected) return it
        const cellY = Math.round(it.y / cellHeight) * cellHeight
        return { ...it, y: cellY + Math.round((cellHeight - it.height) / 2) }
      })
    } else if (type === 'spaceH') {
      if (sel.length < 2) return
      const sorted = [...sel].sort((a, b) => a.x - b.x)
      const totalItemWidth = sorted.reduce((sum, it) => sum + it.width, 0)
      const totalSpace = bounds.right - bounds.left - totalItemWidth
      const gap = totalSpace / (sorted.length - 1)
      let currentX = bounds.left
      sorted.forEach((it) => {
        newItems = newItems.map((ni) => ni.id === it.id ? { ...ni, x: Math.round(currentX) } : ni)
        currentX += it.width + gap
      })
    } else if (type === 'spaceV') {
      if (sel.length < 2) return
      const sorted = [...sel].sort((a, b) => a.y - b.y)
      const totalItemHeight = sorted.reduce((sum, it) => sum + it.height, 0)
      const totalSpace = bounds.bottom - bounds.top - totalItemHeight
      const gap = totalSpace / (sorted.length - 1)
      let currentY = bounds.top
      sorted.forEach((it) => {
        newItems = newItems.map((ni) => ni.id === it.id ? { ...ni, y: Math.round(currentY) } : ni)
        currentY += it.height + gap
      })
    }

    pushHistory(newItems)
  }, [items, pushHistory, cellWidth, cellHeight])

  // --- Item property updates ---
  const updateSelectedItem = useCallback((field, value) => {
    const sel = items.filter((it) => it.selected)
    if (sel.length !== 1) return
    const newItems = items.map((it) =>
      it.selected ? { ...it, [field]: value } : it
    )
    pushHistory(newItems)
  }, [items, pushHistory])

  // --- Z-order reorder ---
  const moveItemZ = useCallback((itemId, direction) => {
    const idx = items.findIndex((it) => it.id === itemId)
    if (idx === -1) return
    const newItems = [...items]
    if (direction === 'up' && idx < newItems.length - 1) {
      [newItems[idx], newItems[idx + 1]] = [newItems[idx + 1], newItems[idx]]
    } else if (direction === 'down' && idx > 0) {
      [newItems[idx], newItems[idx - 1]] = [newItems[idx - 1], newItems[idx]]
    }
    pushHistory(newItems)
  }, [items, pushHistory])

  // --- Export ---
  const handleExport = useCallback(async () => {
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = canvasWidth
    exportCanvas.height = canvasHeight
    const ctx = exportCanvas.getContext('2d')

    // Draw background
    if (bgCanvasRef.current) {
      ctx.drawImage(bgCanvasRef.current, 0, 0, canvasWidth, canvasHeight)
    }

    // Draw all items in order
    for (const item of items) {
      try {
        const img = imageCacheRef.current[item.url] || await loadImage(item.url)
        ctx.drawImage(img, item.x, item.y, item.width, item.height)
      } catch (err) {
        console.error('Failed to draw item:', err)
      }
    }

    exportCanvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, 'composed-spritesheet.png')
    }, 'image/png')
  }, [canvasWidth, canvasHeight, items])

  const singleSelected = selectedItems.length === 1 ? selectedItems[0] : null

  return (
    <div className="composer-container">
      <div className="tool-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h2>Spritesheet Composer</h2>
      </div>

      {/* Toolbar */}
      <div className="composer-toolbar">
        <div className="composer-tool-group">
          <button
            className={`toolbar-btn ${activeTool === 'move' ? 'active' : ''}`}
            onClick={() => setActiveTool('move')}
            title="Move tool"
          >
            Move
          </button>
          <button
            className={`toolbar-btn ${activeTool === 'regionSelect' ? 'active' : ''}`}
            onClick={() => setActiveTool('regionSelect')}
            title="Region Select — cut a region from the background"
            disabled={!bgCanvasRef.current}
          >
            Region Select
          </button>
        </div>
        <div className="composer-tool-group">
          <button className="toolbar-btn" onClick={() => fileInputRef.current?.click()}>
            Import Images
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImportImages}
            style={{ display: 'none' }}
          />
          <button className="toolbar-btn" onClick={() => setShowSliceModal(true)}>
            Import Spritesheet
          </button>
          <button className="toolbar-btn" onClick={() => bgInputRef.current?.click()}>
            Load Background
          </button>
          <input
            ref={bgInputRef}
            type="file"
            accept="image/*"
            onChange={handleLoadBackground}
            style={{ display: 'none' }}
          />
        </div>
        <div className="composer-tool-group">
          <button
            className="toolbar-btn"
            onClick={handleUndo}
            disabled={!canUndo(history)}
            title="Undo (Ctrl+Z)"
          >
            Undo
          </button>
          <button
            className="toolbar-btn"
            onClick={handleRedo}
            disabled={!canRedo(history)}
            title="Redo (Ctrl+Shift+Z)"
          >
            Redo
          </button>
        </div>
      </div>

      <div className="editor-section">
        {/* Canvas area */}
        <div className="editor-left">
          <div className="composer-canvas-area" ref={containerRef}>
            <canvas
              ref={canvasRef}
              className={`composer-canvas ${activeTool === 'regionSelect' ? 'cursor-crosshair' : ''}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="editor-right">
          {/* Canvas size */}
          <div className="export-settings">
            <h3>Canvas</h3>
            <div className="settings-group">
              <div className="dimension-row">
                <label>
                  Width
                  <input
                    type="number"
                    min="1"
                    value={canvasWidth}
                    onChange={(e) => setCanvasWidth(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </label>
                <label>
                  Height
                  <input
                    type="number"
                    min="1"
                    value={canvasHeight}
                    onChange={(e) => setCanvasHeight(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Grid settings */}
          <div className="export-settings">
            <h3>Grid</h3>
            <div className="settings-group">
              <label>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  Show Grid
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                </span>
              </label>
              <div className="dimension-row">
                <label>
                  Cell W
                  <input
                    type="number"
                    min="1"
                    value={cellWidth}
                    onChange={(e) => setCellWidth(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </label>
                <label>
                  Cell H
                  <input
                    type="number"
                    min="1"
                    value={cellHeight}
                    onChange={(e) => setCellHeight(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Alignment */}
          {selectedItems.length > 0 && (
            <div className="export-settings">
              <h3>Align ({selectedItems.length} selected)</h3>
              <div className="alignment-toolbar">
                <button className="toolbar-btn" onClick={() => alignItems('left')} title="Align left">L</button>
                <button className="toolbar-btn" onClick={() => alignItems('centerH')} title="Center in cell H">CH</button>
                <button className="toolbar-btn" onClick={() => alignItems('right')} title="Align right">R</button>
                <button className="toolbar-btn" onClick={() => alignItems('top')} title="Align top">T</button>
                <button className="toolbar-btn" onClick={() => alignItems('centerV')} title="Center in cell V">CV</button>
                <button className="toolbar-btn" onClick={() => alignItems('bottom')} title="Align bottom">B</button>
                <button className="toolbar-btn" onClick={() => alignItems('spaceH')} title="Space out horizontally" disabled={selectedItems.length < 2}>SH</button>
                <button className="toolbar-btn" onClick={() => alignItems('spaceV')} title="Space out vertically" disabled={selectedItems.length < 2}>SV</button>
              </div>
            </div>
          )}

          {/* Selected item properties */}
          {singleSelected && (
            <div className="export-settings">
              <h3>Item Properties</h3>
              <div className="settings-group">
                <div className="dimension-row">
                  <label>
                    X
                    <input
                      type="number"
                      value={singleSelected.x}
                      onChange={(e) => updateSelectedItem('x', parseInt(e.target.value) || 0)}
                    />
                  </label>
                  <label>
                    Y
                    <input
                      type="number"
                      value={singleSelected.y}
                      onChange={(e) => updateSelectedItem('y', parseInt(e.target.value) || 0)}
                    />
                  </label>
                </div>
                <div className="dimension-row">
                  <label>
                    W
                    <input
                      type="number"
                      min="1"
                      value={singleSelected.width}
                      onChange={(e) => {
                        const w = Math.max(1, parseInt(e.target.value) || 1)
                        if (lockAspect && singleSelected.naturalWidth) {
                          const aspect = singleSelected.naturalHeight / singleSelected.naturalWidth
                          const newItems = items.map((it) =>
                            it.selected ? { ...it, width: w, height: Math.round(w * aspect) } : it
                          )
                          pushHistory(newItems)
                        } else {
                          updateSelectedItem('width', w)
                        }
                      }}
                    />
                  </label>
                  <label>
                    H
                    <input
                      type="number"
                      min="1"
                      value={singleSelected.height}
                      onChange={(e) => {
                        const h = Math.max(1, parseInt(e.target.value) || 1)
                        if (lockAspect && singleSelected.naturalHeight) {
                          const aspect = singleSelected.naturalWidth / singleSelected.naturalHeight
                          const newItems = items.map((it) =>
                            it.selected ? { ...it, height: h, width: Math.round(h * aspect) } : it
                          )
                          pushHistory(newItems)
                        } else {
                          updateSelectedItem('height', h)
                        }
                      }}
                    />
                  </label>
                  <button
                    className={`lock-ar-btn ${lockAspect ? 'locked' : ''}`}
                    onClick={() => setLockAspect(!lockAspect)}
                    title="Lock aspect ratio"
                  >
                    {lockAspect ? '🔒' : '🔓'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Item list */}
          {items.length > 0 && (
            <div className="export-settings">
              <h3>Items ({items.length})</h3>
              <div className="item-list">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`item-list-row ${item.selected ? 'selected' : ''}`}
                    onClick={() => {
                      const newItems = items.map((it) => ({
                        ...it,
                        selected: it.id === item.id,
                      }))
                      pushHistory(newItems)
                    }}
                  >
                    <img src={item.url} alt="" className="item-list-thumb" />
                    <span className="item-list-label">
                      #{idx + 1} ({item.width}x{item.height})
                    </span>
                    <div className="item-list-actions">
                      <button
                        className="item-z-btn"
                        onClick={(e) => { e.stopPropagation(); moveItemZ(item.id, 'up') }}
                        disabled={idx === items.length - 1}
                        title="Move up (forward)"
                      >
                        ↑
                      </button>
                      <button
                        className="item-z-btn"
                        onClick={(e) => { e.stopPropagation(); moveItemZ(item.id, 'down') }}
                        disabled={idx === 0}
                        title="Move down (backward)"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delete + Export */}
          <div className="export-actions">
            {selectedItems.length > 0 && (
              <button className="btn-secondary" onClick={deleteSelected}>
                Delete selected ({selectedItems.length})
              </button>
            )}
            <button className="btn-primary" onClick={handleExport}>
              Export PNG
            </button>
          </div>
        </div>
      </div>

      {showSliceModal && (
        <SliceModal
          onImport={handleSliceImport}
          onClose={() => setShowSliceModal(false)}
        />
      )}
    </div>
  )
}
