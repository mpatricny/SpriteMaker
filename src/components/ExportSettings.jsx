import { useState, useEffect } from 'react'

export default function ExportSettings({
  frameCount,
  originalWidth,
  originalHeight,
  settings,
  onSettingsChange,
  onExport,
  onRemoveBackground,
  isExporting,
  isRemovingBackground,
  hideBackgroundButton = false,
}) {
  const rows = Math.ceil(frameCount / settings.columns)

  const handleChange = (key, value) => {
    onSettingsChange({
      ...settings,
      [key]: value,
    })
  }

  const totalWidth = settings.columns * settings.frameWidth + (settings.columns - 1) * settings.padding
  const totalHeight = rows * settings.frameHeight + (rows - 1) * settings.padding

  return (
    <div className="export-settings">
      <h3>Export settings</h3>

      <div className="settings-group">
        <label>
          Frame width (px)
          <input
            type="number"
            min="1"
            max="2048"
            value={settings.frameWidth}
            onChange={(e) => handleChange('frameWidth', parseInt(e.target.value) || 1)}
          />
        </label>

        <label>
          Frame height (px)
          <input
            type="number"
            min="1"
            max="2048"
            value={settings.frameHeight}
            onChange={(e) => handleChange('frameHeight', parseInt(e.target.value) || 1)}
          />
        </label>

        <button
          className="aspect-ratio-btn"
          onClick={() => {
            if (originalWidth && originalHeight) {
              handleChange('frameWidth', originalWidth)
              handleChange('frameHeight', originalHeight)
            }
          }}
        >
          Original size
        </button>
      </div>

      <div className="settings-group">
        <label>
          Number of columns
          <input
            type="number"
            min="1"
            max={frameCount}
            value={settings.columns}
            onChange={(e) => handleChange('columns', parseInt(e.target.value) || 1)}
          />
        </label>

        <label>
          Padding (px)
          <input
            type="number"
            min="0"
            max="100"
            value={settings.padding}
            onChange={(e) => handleChange('padding', parseInt(e.target.value) || 0)}
          />
        </label>
      </div>

      <div className="export-info">
        <p>Result size: <strong>{totalWidth} × {totalHeight} px</strong></p>
        <p>Frame count: <strong>{frameCount}</strong></p>
        <p>Rows × Columns: <strong>{rows} × {settings.columns}</strong></p>
      </div>

      <div className="export-actions">
        {!hideBackgroundButton && (
          <button
            className="btn-secondary"
            onClick={onRemoveBackground}
            disabled={isRemovingBackground || isExporting}
          >
            {isRemovingBackground ? 'Removing background...' : 'Remove background (AI)'}
          </button>
        )}

        <button
          className="btn-primary"
          onClick={onExport}
          disabled={isExporting || isRemovingBackground}
        >
          {isExporting ? 'Generating...' : 'Download PNG'}
        </button>
      </div>
    </div>
  )
}
