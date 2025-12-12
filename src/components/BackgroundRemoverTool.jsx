import { useState, useRef } from 'react'
import { useBackgroundRemoval } from '../hooks/useBackgroundRemoval'

export default function BackgroundRemoverTool({ onBack }) {
  const [originalImage, setOriginalImage] = useState(null)
  const [resultImage, setResultImage] = useState(null)
  const fileInputRef = useRef(null)

  const { removeBackgroundFromFrames, isRemoving, progress } = useBackgroundRemoval()

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Select an image (PNG, JPG, WEBP...)')
      return
    }

    const url = URL.createObjectURL(file)
    setOriginalImage({ url, name: file.name })
    setResultImage(null)
  }

  const handleRemoveBackground = async () => {
    if (!originalImage) return

    try {
      const frames = [{ id: 'single', url: originalImage.url }]
      const result = await removeBackgroundFromFrames(frames)

      if (result.length > 0) {
        setResultImage(result[0].url)
      }
    } catch (error) {
      console.error('Background removal error:', error)
      alert('Background removal error: ' + error.message)
    }
  }

  const handleDownload = () => {
    if (!resultImage) return

    const link = document.createElement('a')
    link.href = resultImage

    // Generate filename
    const originalName = originalImage?.name || 'image'
    const baseName = originalName.replace(/\.[^.]+$/, '')
    link.download = `${baseName}-no-bg.png`

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleReset = () => {
    if (originalImage) {
      URL.revokeObjectURL(originalImage.url)
    }
    if (resultImage) {
      URL.revokeObjectURL(resultImage)
    }
    setOriginalImage(null)
    setResultImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="bg-remover-tool">
      <div className="tool-header">
        <button className="btn-back" onClick={onBack}>
          ← Back to selection
        </button>
        <h2>Remove background from image</h2>
      </div>

      {!originalImage ? (
        <div className="upload-area">
          <div className="upload-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
              <path d="M14 8a2 2 0 11-4 0 2 2 0 014 0z" />
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
          </div>
          <p className="upload-text">Upload an image</p>
          <p className="upload-subtext">PNG, JPG, WEBP...</p>
          <label className="upload-button">
            Select file
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
            />
          </label>
        </div>
      ) : (
        <div className="bg-remover-content">
          <div className="image-comparison">
            <div className="image-panel">
              <h4>Original</h4>
              <div className="image-container">
                <img src={originalImage.url} alt="Original" />
              </div>
            </div>

            <div className="image-panel">
              <h4>Without background</h4>
              <div className="image-container transparent-bg">
                {resultImage ? (
                  <img src={resultImage} alt="Without background" />
                ) : (
                  <div className="placeholder">
                    {isRemoving ? (
                      <div className="processing">
                        <div className="mini-spinner"></div>
                        <span>Processing... {progress}%</span>
                      </div>
                    ) : (
                      <span>Click "Remove background"</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-remover-actions">
            <button className="btn-secondary" onClick={handleReset}>
              Upload different image
            </button>

            {!resultImage ? (
              <button
                className="btn-primary"
                onClick={handleRemoveBackground}
                disabled={isRemoving}
              >
                {isRemoving ? `Removing... ${progress}%` : 'Remove background'}
              </button>
            ) : (
              <button className="btn-primary" onClick={handleDownload}>
                Download PNG
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
