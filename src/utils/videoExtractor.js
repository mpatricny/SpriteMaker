/**
 * Extract frames from video using HTML5 Video API and Canvas
 * This is a fallback that doesn't require FFmpeg
 */
export async function extractFramesFromVideoNative(file, fps = 10, onProgress) {
  console.log('[VideoExtractor] Starting native extraction for:', file.name)

  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    video.muted = true
    video.playsInline = true

    const frames = []
    let currentTime = 0
    const frameInterval = 1 / fps

    video.onloadedmetadata = () => {
      console.log('[VideoExtractor] Video loaded:', video.duration, 'seconds')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      if (onProgress) onProgress(10)

      captureFrames()
    }

    video.onerror = (e) => {
      console.error('[VideoExtractor] Video error:', e)
      reject(new Error('Nepodařilo se načíst video: ' + (video.error?.message || 'Unknown error')))
    }

    const captureFrames = async () => {
      const totalFrames = Math.floor(video.duration * fps)
      console.log('[VideoExtractor] Total frames to capture:', totalFrames)

      const captureFrame = () => {
        return new Promise((resolveFrame) => {
          video.onseeked = () => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob)
                frames.push({
                  id: `frame-${frames.length + 1}`,
                  url,
                  index: frames.length,
                  time: currentTime,
                })
              }
              resolveFrame()
            }, 'image/png')
          }

          video.currentTime = currentTime
        })
      }

      while (currentTime < video.duration) {
        await captureFrame()

        const progress = 10 + Math.round((currentTime / video.duration) * 85)
        if (onProgress) onProgress(progress)

        currentTime += frameInterval
      }

      console.log('[VideoExtractor] Captured frames:', frames.length)

      // Cleanup
      URL.revokeObjectURL(video.src)

      if (onProgress) onProgress(100)

      if (frames.length === 0) {
        reject(new Error('Nepodařilo se extrahovat žádné framy'))
      } else {
        resolve(frames)
      }
    }

    // Create object URL and load video
    const videoUrl = URL.createObjectURL(file)
    video.src = videoUrl
    video.load()
  })
}
