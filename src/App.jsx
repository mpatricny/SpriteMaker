import { useState, useCallback } from 'react'
import FileUpload from './components/FileUpload'
import FrameGrid from './components/FrameGrid'
import ExportSettings from './components/ExportSettings'
import SpritePreview from './components/SpritePreview'
import LoadingOverlay from './components/LoadingOverlay'
import StepIndicator from './components/StepIndicator'
import EditingStep from './components/EditingStep'
import BackgroundRemoverTool from './components/BackgroundRemoverTool'
import SpritesheetComposer from './components/SpritesheetComposer'
import { extractFramesFromVideo } from './utils/ffmpeg'
import { extractFramesFromGif } from './utils/gifExtractor'
import { generateSpriteSheet, downloadBlob } from './utils/spriteGenerator'
import { useBackgroundRemoval } from './hooks/useBackgroundRemoval'
import { calculateCommonBounds, applyCropToFrames } from './utils/autoCrop'
import { flipFramesHorizontal } from './utils/imageTransform'
import { saveProject, loadProject, isFileSystemAccessSupported } from './utils/projectStorage'

function App() {
  // Tool selection (null = selector, 'sprite' = sprite maker, 'bgremover' = background remover, 'composer' = spritesheet composer)
  const [currentTool, setCurrentTool] = useState(null)

  // Step state (1=upload, 2=selection, 3=editing, 4=export)
  const [currentStep, setCurrentStep] = useState(1)
  const [maxReachedStep, setMaxReachedStep] = useState(1)

  // Frame state
  const [frames, setFrames] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 })

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingMessage, setProcessingMessage] = useState('')
  const [processingProgress, setProcessingProgress] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [isAutoCropping, setIsAutoCropping] = useState(false)
  const [autoCropProgress, setAutoCropProgress] = useState(0)
  const [isFlipping, setIsFlipping] = useState(false)
  const [flipProgress, setFlipProgress] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingProject, setIsLoadingProject] = useState(false)
  const [saveLoadProgress, setSaveLoadProgress] = useState(0)

  // Export settings
  const [settings, setSettings] = useState({
    frameWidth: 64,
    frameHeight: 64,
    columns: 4,
    padding: 0,
  })

  const { removeBackgroundFromFrames, isRemoving, progress: bgProgress } = useBackgroundRemoval()

  // Step navigation
  const goToStep = useCallback((step) => {
    setCurrentStep(step)
    if (step > maxReachedStep) {
      setMaxReachedStep(step)
    }
  }, [maxReachedStep])

  // File upload handler
  const handleFileSelect = useCallback(async (file) => {
    setIsProcessing(true)
    setProcessingProgress(0)

    try {
      let extractedFrames

      if (file.type === 'image/gif' || file.name.endsWith('.gif')) {
        setProcessingMessage('Extracting frames from GIF...')
        extractedFrames = await extractFramesFromGif(file, setProcessingProgress)
      } else {
        setProcessingMessage('Extracting frames from video...')
        extractedFrames = await extractFramesFromVideo(file, 10, setProcessingProgress)
      }

      if (extractedFrames.length > 0) {
        const img = new Image()
        img.onload = () => {
          setOriginalDimensions({ width: img.naturalWidth, height: img.naturalHeight })
          setSettings((prev) => ({
            ...prev,
            frameWidth: img.naturalWidth,
            frameHeight: img.naturalHeight,
          }))
        }
        img.src = extractedFrames[0].url
      }

      setFrames(extractedFrames)
      setSelectedIds(extractedFrames.map((f) => f.id))
      goToStep(2)
    } catch (error) {
      console.error('Error processing file:', error)
      alert('Error processing file: ' + error.message)
    } finally {
      setIsProcessing(false)
      setProcessingMessage('')
    }
  }, [goToStep])

  // Frame selection handlers
  const handleToggleSelect = useCallback((id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedIds(frames.map((f) => f.id))
  }, [frames])

  const handleDeselectAll = useCallback(() => {
    setSelectedIds([])
  }, [])

  const handleInvertSelection = useCallback(() => {
    setSelectedIds((prev) =>
      frames.filter((f) => !prev.includes(f.id)).map((f) => f.id)
    )
  }, [frames])

  const handleFramesReorder = useCallback((newFrames) => {
    setFrames(newFrames)
  }, [])

  // Export handler
  const handleExport = useCallback(async () => {
    const selectedFrames = frames.filter((f) => selectedIds.includes(f.id))
    if (selectedFrames.length === 0) {
      alert('Select at least one frame')
      return
    }

    setIsExporting(true)

    try {
      const blob = await generateSpriteSheet(selectedFrames, settings)
      downloadBlob(blob, 'spritesheet.png')
    } catch (error) {
      console.error('Export error:', error)
      alert('Export error: ' + error.message)
    } finally {
      setIsExporting(false)
    }
  }, [frames, selectedIds, settings])

  // Background removal handler
  const handleRemoveBackground = useCallback(async () => {
    const selectedFrames = frames.filter((f) => selectedIds.includes(f.id))
    if (selectedFrames.length === 0) {
      alert('Select at least one frame')
      return
    }

    if (selectedFrames.length > 20) {
      const confirm = window.confirm(
        `You have selected ${selectedFrames.length} frames. Background removal may take a long time. Continue?`
      )
      if (!confirm) return
    }

    try {
      const processedFrames = await removeBackgroundFromFrames(selectedFrames)

      setFrames((prev) =>
        prev.map((frame) => {
          const processed = processedFrames.find((p) => p.id === frame.id)
          return processed || frame
        })
      )
    } catch (error) {
      console.error('Background removal error:', error)
      alert('Background removal error: ' + error.message)
    }
  }, [frames, selectedIds, removeBackgroundFromFrames])

  // Auto-crop handler
  const handleAutoCrop = useCallback(async () => {
    const targetFrames = frames.filter((f) => selectedIds.includes(f.id))
    if (targetFrames.length === 0) {
      alert('Select at least one frame')
      return
    }

    setIsAutoCropping(true)
    setAutoCropProgress(0)

    try {
      const commonBounds = await calculateCommonBounds(targetFrames, setAutoCropProgress)

      if (commonBounds) {
        const updatedFrames = frames.map((frame) => {
          if (selectedIds.includes(frame.id)) {
            return { ...frame, cropRegion: commonBounds }
          }
          return frame
        })
        setFrames(updatedFrames)

        // Update export settings to match crop size
        setSettings((prev) => ({
          ...prev,
          frameWidth: commonBounds.width,
          frameHeight: commonBounds.height,
        }))
      }
    } catch (error) {
      console.error('Auto-crop error:', error)
      alert('Auto-crop error: ' + error.message)
    } finally {
      setIsAutoCropping(false)
      setAutoCropProgress(0)
    }
  }, [frames, selectedIds])

  // Flip horizontal handler
  const handleFlipHorizontal = useCallback(async () => {
    const targetFrames = frames.filter((f) => selectedIds.includes(f.id))
    if (targetFrames.length === 0) {
      alert('Select at least one frame')
      return
    }

    setIsFlipping(true)
    setFlipProgress(0)

    try {
      const flippedFrames = await flipFramesHorizontal(targetFrames, setFlipProgress)

      // Update frames with flipped URLs
      setFrames((prev) =>
        prev.map((frame) => {
          const flipped = flippedFrames.find((f) => f.id === frame.id)
          return flipped || frame
        })
      )
    } catch (error) {
      console.error('Flip error:', error)
      alert('Flip error: ' + error.message)
    } finally {
      setIsFlipping(false)
      setFlipProgress(0)
    }
  }, [frames, selectedIds])

  // Save project handler
  const handleSaveProject = useCallback(async () => {
    const selectedFrames = frames.filter((f) => selectedIds.includes(f.id))
    if (selectedFrames.length === 0) {
      alert('Select at least one frame to save')
      return
    }

    if (!isFileSystemAccessSupported()) {
      alert('File System Access API is not supported in this browser. Please use Chrome or Edge.')
      return
    }

    setIsSaving(true)
    setSaveLoadProgress(0)

    try {
      const folderName = await saveProject(selectedFrames, settings, setSaveLoadProgress)
      alert(`Project saved to folder: ${folderName}`)
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Save error:', error)
        alert('Save error: ' + error.message)
      }
    } finally {
      setIsSaving(false)
      setSaveLoadProgress(0)
    }
  }, [frames, selectedIds, settings])

  // Load project handler
  const handleLoadProject = useCallback(async () => {
    if (!isFileSystemAccessSupported()) {
      alert('File System Access API is not supported in this browser. Please use Chrome or Edge.')
      return
    }

    setIsLoadingProject(true)
    setSaveLoadProgress(0)

    try {
      const { frames: loadedFrames, settings: loadedSettings, projectName } = await loadProject(setSaveLoadProgress)

      // Revoke old URLs
      frames.forEach((f) => URL.revokeObjectURL(f.url))

      setFrames(loadedFrames)
      setSelectedIds(loadedFrames.map((f) => f.id))
      setSettings((prev) => ({
        ...prev,
        ...loadedSettings,
      }))

      // Get dimensions from first frame
      if (loadedFrames.length > 0) {
        const img = new Image()
        img.onload = () => {
          setOriginalDimensions({ width: img.naturalWidth, height: img.naturalHeight })
        }
        img.src = loadedFrames[0].url
      }

      goToStep(2)
      setMaxReachedStep(2)
      alert(`Project "${projectName}" loaded`)
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Load error:', error)
        alert('Load error: ' + error.message)
      }
    } finally {
      setIsLoadingProject(false)
      setSaveLoadProgress(0)
    }
  }, [frames, goToStep])

  // Reset handler
  const handleReset = useCallback(() => {
    frames.forEach((f) => URL.revokeObjectURL(f.url))
    setFrames([])
    setSelectedIds([])
    setCurrentStep(1)
    setMaxReachedStep(1)
  }, [frames])

  const selectedFrames = frames.filter((f) => selectedIds.includes(f.id))

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="header-title">
            <h1 onClick={() => { setCurrentTool(null); handleReset(); }} style={{ cursor: 'pointer' }}>
              SpriteMaker
            </h1>
            <p>
              {currentTool === 'sprite'
                ? 'Create sprite sheet from video or GIF'
                : currentTool === 'bgremover'
                ? 'Remove background from image using AI'
                : currentTool === 'composer'
                ? 'Compose and arrange sprites on a canvas'
                : 'Tools for working with images and animations'}
            </p>
          </div>
          {currentTool === 'sprite' && isFileSystemAccessSupported() && (
            <div className="header-actions">
              <button
                className="btn-secondary btn-small"
                onClick={handleLoadProject}
                disabled={isLoadingProject || isSaving}
              >
                📂 Load Project
              </button>
              {frames.length > 0 && selectedIds.length > 0 && (
                <button
                  className="btn-secondary btn-small"
                  onClick={handleSaveProject}
                  disabled={isSaving || isLoadingProject}
                >
                  💾 Save Project
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {currentTool === 'sprite' && frames.length > 0 && (
        <StepIndicator
          currentStep={currentStep}
          maxReachedStep={maxReachedStep}
          onStepClick={goToStep}
        />
      )}

      <main className="main">
        {/* Tool Selector */}
        {!currentTool && (
          <div className="tool-selector">
            <div className="tool-card" onClick={() => setCurrentTool('sprite')}>
              <div className="tool-icon">🎬</div>
              <h3>Sprite Sheet Maker</h3>
              <p>Create sprite sheet from video or GIF. Extract frames, edit them, and export as PNG.</p>
            </div>

            <div className="tool-card" onClick={() => setCurrentTool('bgremover')}>
              <div className="tool-icon">✂️</div>
              <h3>Background Remover</h3>
              <p>Remove background from image using AI. Supports PNG, JPG, WEBP and other formats.</p>
            </div>

            <div className="tool-card" onClick={() => setCurrentTool('composer')}>
              <div className="tool-icon">🧩</div>
              <h3>Spritesheet Composer</h3>
              <p>Create and edit spritesheets by importing images, slicing sheets, and arranging sprites on a canvas.</p>
            </div>
          </div>
        )}

        {/* Background Remover Tool */}
        {currentTool === 'bgremover' && (
          <BackgroundRemoverTool onBack={() => setCurrentTool(null)} />
        )}

        {/* Spritesheet Composer */}
        {currentTool === 'composer' && (
          <SpritesheetComposer onBack={() => setCurrentTool(null)} />
        )}

        {/* Sprite Maker - Step 1: Upload */}
        {currentTool === 'sprite' && currentStep === 1 && (
          <FileUpload onFileSelect={handleFileSelect} isProcessing={isProcessing} />
        )}

        {/* Sprite Maker - Step 2: Selection */}
        {currentTool === 'sprite' && currentStep === 2 && (
          <>
            <div className="editor-header">
              <button className="btn-reset" onClick={handleReset}>
                ← Upload different file
              </button>
            </div>
            <div className="selection-step">
              <FrameGrid
                frames={frames}
                selectedIds={selectedIds}
                onFramesReorder={handleFramesReorder}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
                onInvertSelection={handleInvertSelection}
              />
              <div className="step-navigation">
                <div></div>
                <button
                  className="btn-primary"
                  onClick={() => goToStep(3)}
                  disabled={selectedIds.length === 0}
                >
                  Continue to editing →
                </button>
              </div>
            </div>
          </>
        )}

        {/* Sprite Maker - Step 3: Editing */}
        {currentTool === 'sprite' && currentStep === 3 && (
          <EditingStep
            frames={frames}
            selectedIds={selectedIds}
            originalWidth={originalDimensions.width}
            originalHeight={originalDimensions.height}
            onFramesUpdate={setFrames}
            onRemoveBackground={handleRemoveBackground}
            onAutoCrop={handleAutoCrop}
            onFlipHorizontal={handleFlipHorizontal}
            isRemovingBackground={isRemoving}
            isAutoCropping={isAutoCropping}
            isFlipping={isFlipping}
            autoCropProgress={autoCropProgress}
            onBack={() => goToStep(2)}
            onNext={() => goToStep(4)}
          />
        )}

        {/* Sprite Maker - Step 4: Export */}
        {currentTool === 'sprite' && currentStep === 4 && (
          <>
            <div className="editor-section">
              <div className="editor-left">
                <div className="export-frames-preview">
                  <h3>Selected frames ({selectedFrames.length})</h3>
                  <div className="mini-frame-grid">
                    {selectedFrames.slice(0, 12).map((frame) => (
                      <div key={frame.id} className="mini-frame">
                        <img src={frame.url} alt="" />
                      </div>
                    ))}
                    {selectedFrames.length > 12 && (
                      <div className="mini-frame more">+{selectedFrames.length - 12}</div>
                    )}
                  </div>
                </div>
                {selectedFrames.length > 0 && (
                  <SpritePreview frames={selectedFrames} settings={settings} />
                )}
              </div>
              <div className="editor-right">
                <ExportSettings
                  frameCount={selectedFrames.length}
                  originalWidth={originalDimensions.width}
                  originalHeight={originalDimensions.height}
                  frames={selectedFrames}
                  settings={settings}
                  onSettingsChange={setSettings}
                  onExport={handleExport}
                  onRemoveBackground={handleRemoveBackground}
                  isExporting={isExporting}
                  isRemovingBackground={isRemoving}
                  hideBackgroundButton={true}
                />
              </div>
            </div>
            <div className="step-navigation">
              <button className="btn-secondary" onClick={() => goToStep(3)}>
                ← Back to editing
              </button>
              <div></div>
            </div>
          </>
        )}
      </main>

      {(isProcessing || isRemoving || isAutoCropping || isFlipping || isSaving || isLoadingProject) && (
        <LoadingOverlay
          message={
            isSaving
              ? 'Saving project...'
              : isLoadingProject
              ? 'Loading project...'
              : isFlipping
              ? 'Flipping frames...'
              : isAutoCropping
              ? 'Detecting boundaries...'
              : isRemoving
              ? 'Removing background...'
              : processingMessage
          }
          progress={
            isSaving || isLoadingProject
              ? saveLoadProgress
              : isFlipping
              ? flipProgress
              : isAutoCropping
              ? autoCropProgress
              : isRemoving
              ? bgProgress
              : processingProgress
          }
        />
      )}
    </div>
  )
}

export default App
