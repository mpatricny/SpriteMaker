import { useEffect, useRef, useState } from 'react'

export default function SpritePreview({ frames, settings }) {
  const canvasRef = useRef(null)
  const animCanvasRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentFrame, setCurrentFrame] = useState(0)
  const animationRef = useRef(null)

  const { frameWidth, frameHeight, columns, padding } = settings
  const rows = Math.ceil(frames.length / columns)
  const totalWidth = columns * frameWidth + (columns - 1) * padding
  const totalHeight = rows * frameHeight + (rows - 1) * padding

  // Draw sprite sheet with crop regions applied
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || frames.length === 0) return

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, totalWidth, totalHeight)

    frames.forEach((frame, i) => {
      const img = new Image()
      img.onload = () => {
        const col = i % columns
        const row = Math.floor(i / columns)
        const destX = col * (frameWidth + padding)
        const destY = row * (frameHeight + padding)

        if (frame.cropRegion) {
          // Draw cropped region
          ctx.drawImage(
            img,
            frame.cropRegion.x,
            frame.cropRegion.y,
            frame.cropRegion.width,
            frame.cropRegion.height,
            destX,
            destY,
            frameWidth,
            frameHeight
          )
        } else {
          // Draw full image
          ctx.drawImage(img, destX, destY, frameWidth, frameHeight)
        }
      }
      img.src = frame.url
    })
  }, [frames, settings, totalWidth, totalHeight, columns, frameWidth, frameHeight, padding])

  // Draw animation frame with crop region applied
  useEffect(() => {
    const canvas = animCanvasRef.current
    if (!canvas || !isPlaying || frames.length === 0) return

    const frame = frames[currentFrame]
    if (!frame) return

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, frameWidth, frameHeight)

    const img = new Image()
    img.onload = () => {
      if (frame.cropRegion) {
        ctx.drawImage(
          img,
          frame.cropRegion.x,
          frame.cropRegion.y,
          frame.cropRegion.width,
          frame.cropRegion.height,
          0,
          0,
          frameWidth,
          frameHeight
        )
      } else {
        ctx.drawImage(img, 0, 0, frameWidth, frameHeight)
      }
    }
    img.src = frame.url
  }, [currentFrame, isPlaying, frames, frameWidth, frameHeight])

  useEffect(() => {
    if (isPlaying && frames.length > 0) {
      animationRef.current = setInterval(() => {
        setCurrentFrame((prev) => (prev + 1) % frames.length)
      }, 100)
    } else {
      clearInterval(animationRef.current)
    }

    return () => clearInterval(animationRef.current)
  }, [isPlaying, frames.length])

  // Calculate scale to fit in preview area but also scale up small sprites
  const maxPreviewSize = 600
  const minDisplaySize = 300
  const largestDimension = Math.max(totalWidth, totalHeight)

  // Scale down if too large, or scale up if too small
  let scale
  if (largestDimension > maxPreviewSize) {
    scale = maxPreviewSize / largestDimension
  } else if (largestDimension < minDisplaySize) {
    scale = Math.min(3, minDisplaySize / largestDimension)
  } else {
    scale = 1
  }

  // Animation preview - target around 120-150px for the frame
  const targetAnimSize = 120
  const animationScale = Math.max(1, Math.min(3, targetAnimSize / Math.max(frameWidth, frameHeight)))

  return (
    <div className="sprite-preview">
      <h4>Sprite sheet preview</h4>

      <div className="preview-container">
        <canvas
          ref={canvasRef}
          width={totalWidth}
          height={totalHeight}
          style={{
            width: totalWidth * scale,
            height: totalHeight * scale,
            imageRendering: scale > 1 ? 'pixelated' : 'auto'
          }}
        />
      </div>

      {frames.length > 1 && (
        <div className="animation-controls">
          <button
            className="play-btn"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? 'Stop' : 'Play animation'}
          </button>
          {isPlaying && frames[currentFrame] && (
            <div className="current-frame-preview">
              <canvas
                ref={animCanvasRef}
                width={frameWidth}
                height={frameHeight}
                style={{
                  width: frameWidth * animationScale,
                  height: frameHeight * animationScale,
                  imageRendering: 'pixelated'
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
