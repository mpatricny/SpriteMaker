/**
 * Load an image from URL and return HTMLImageElement
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

/**
 * Detect bounding box of non-transparent pixels in an image
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<{x: number, y: number, width: number, height: number}>}
 */
export async function detectBounds(imageUrl) {
  const img = await loadImage(imageUrl)

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')

  ctx.drawImage(img, 0, 0)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  let minX = canvas.width
  let minY = canvas.height
  let maxX = 0
  let maxY = 0

  // Scan all pixels to find bounding box of non-transparent pixels
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const alpha = data[(y * canvas.width + x) * 4 + 3]

      // If pixel is not fully transparent (alpha > 0)
      if (alpha > 0) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }

  // If no non-transparent pixels found, return full image
  if (minX > maxX || minY > maxY) {
    return {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
    }
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  }
}

/**
 * Calculate common bounding box that encompasses all frames
 * @param {Array<{url: string}>} frames - Array of frame objects with URLs
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<{x: number, y: number, width: number, height: number}>}
 */
export async function calculateCommonBounds(frames, onProgress) {
  if (frames.length === 0) {
    return null
  }

  let commonMinX = Infinity
  let commonMinY = Infinity
  let commonMaxX = 0
  let commonMaxY = 0

  for (let i = 0; i < frames.length; i++) {
    const bounds = await detectBounds(frames[i].url)

    commonMinX = Math.min(commonMinX, bounds.x)
    commonMinY = Math.min(commonMinY, bounds.y)
    commonMaxX = Math.max(commonMaxX, bounds.x + bounds.width)
    commonMaxY = Math.max(commonMaxY, bounds.y + bounds.height)

    if (onProgress) {
      onProgress(Math.round(((i + 1) / frames.length) * 100))
    }
  }

  return {
    x: commonMinX,
    y: commonMinY,
    width: commonMaxX - commonMinX,
    height: commonMaxY - commonMinY,
  }
}

/**
 * Apply crop region to all frames
 * @param {Array} frames - Array of frame objects
 * @param {{x: number, y: number, width: number, height: number}} cropRegion
 * @returns {Array} - Frames with cropRegion applied
 */
export function applyCropToFrames(frames, cropRegion) {
  return frames.map(frame => ({
    ...frame,
    cropRegion: { ...cropRegion },
  }))
}

/**
 * Remove crop from all frames
 * @param {Array} frames - Array of frame objects
 * @returns {Array} - Frames without cropRegion
 */
export function removeCropFromFrames(frames) {
  return frames.map(frame => {
    const { cropRegion, ...rest } = frame
    return rest
  })
}
