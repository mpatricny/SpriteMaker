import { useCallback, useState } from 'react'

const ACCEPTED_TYPES = {
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'video/quicktime': ['.mov'],
  'image/gif': ['.gif'],
}

export default function FileUpload({ onFileSelect, isProcessing }) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file && isValidFile(file)) {
      onFileSelect(file)
    }
  }, [onFileSelect])

  const handleFileInput = useCallback((e) => {
    const file = e.target.files[0]
    if (file && isValidFile(file)) {
      onFileSelect(file)
    }
  }, [onFileSelect])

  const isValidFile = (file) => {
    return file.type in ACCEPTED_TYPES || file.name.endsWith('.gif') || file.name.endsWith('.mov')
  }

  return (
    <div
      className={`file-upload ${isDragging ? 'dragging' : ''} ${isProcessing ? 'processing' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isProcessing ? (
        <div className="processing-indicator">
          <div className="spinner"></div>
          <p>Processing file...</p>
        </div>
      ) : (
        <>
          <div className="upload-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17,8 12,3 7,8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p className="upload-text">Drag and drop video or GIF here</p>
          <p className="upload-subtext">or</p>
          <label className="upload-button">
            <input
              type="file"
              accept=".mp4,.webm,.mov,.gif,video/mp4,video/webm,video/quicktime,image/gif"
              onChange={handleFileInput}
            />
            Select file
          </label>
          <p className="upload-formats">Supported formats: MP4, WebM, MOV, GIF</p>
        </>
      )}
    </div>
  )
}
