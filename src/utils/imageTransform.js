/**
 * Load an image from URL
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
 * Flip an image horizontally
 * @param {string} imageUrl - URL of the image to flip
 * @returns {Promise<string>} - New blob URL of flipped image
 */
export async function flipHorizontal(imageUrl) {
  const img = await loadImage(imageUrl)

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')

  // Flip horizontally
  ctx.translate(canvas.width, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(img, 0, 0)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob)
      resolve(url)
    }, 'image/png')
  })
}

/**
 * Flip multiple frames horizontally
 * @param {Array} frames - Array of frame objects with url property
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<Array>} - Frames with flipped URLs
 */
export async function flipFramesHorizontal(frames, onProgress) {
  const flippedFrames = []

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    const flippedUrl = await flipHorizontal(frame.url)

    // Revoke old URL to free memory
    URL.revokeObjectURL(frame.url)

    flippedFrames.push({
      ...frame,
      url: flippedUrl,
    })

    if (onProgress) {
      onProgress(Math.round(((i + 1) / frames.length) * 100))
    }
  }

  return flippedFrames
}
