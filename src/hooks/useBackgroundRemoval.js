import { useState, useCallback } from 'react'
import { removeBackground } from '@imgly/background-removal'

export function useBackgroundRemoval() {
  const [isRemoving, setIsRemoving] = useState(false)
  const [progress, setProgress] = useState(0)

  const removeBackgroundFromFrames = useCallback(async (frames, onProgress) => {
    setIsRemoving(true)
    setProgress(0)

    const processedFrames = []

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i]

      try {
        const response = await fetch(frame.url)
        const blob = await response.blob()

        const resultBlob = await removeBackground(blob, {
          progress: (key, current, total) => {
            // Progress pro jednotlivý frame
          },
        })

        const newUrl = URL.createObjectURL(resultBlob)

        processedFrames.push({
          ...frame,
          url: newUrl,
          originalUrl: frame.url,
        })
      } catch (error) {
        console.error(`Failed to remove background from frame ${i}:`, error)
        processedFrames.push(frame)
      }

      const currentProgress = Math.round(((i + 1) / frames.length) * 100)
      setProgress(currentProgress)
      if (onProgress) {
        onProgress(currentProgress)
      }
    }

    setIsRemoving(false)
    setProgress(0)

    return processedFrames
  }, [])

  return {
    removeBackgroundFromFrames,
    isRemoving,
    progress,
  }
}
