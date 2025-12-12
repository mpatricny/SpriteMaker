export async function generateSpriteSheet(frames, settings) {
  const { frameWidth, frameHeight, columns, padding } = settings

  const rows = Math.ceil(frames.length / columns)
  const totalWidth = columns * frameWidth + (columns - 1) * padding
  const totalHeight = rows * frameHeight + (rows - 1) * padding

  const canvas = document.createElement('canvas')
  canvas.width = totalWidth
  canvas.height = totalHeight
  const ctx = canvas.getContext('2d')

  ctx.clearRect(0, 0, totalWidth, totalHeight)

  const loadImage = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = url
    })
  }

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    const col = i % columns
    const row = Math.floor(i / columns)
    const destX = col * (frameWidth + padding)
    const destY = row * (frameHeight + padding)

    try {
      const img = await loadImage(frame.url)

      if (frame.cropRegion) {
        // Draw with crop region
        const { x, y, width, height } = frame.cropRegion
        ctx.drawImage(
          img,
          x, y, width, height,           // Source region
          destX, destY, frameWidth, frameHeight  // Destination
        )
      } else {
        // Draw full image
        ctx.drawImage(img, destX, destY, frameWidth, frameHeight)
      }
    } catch (error) {
      console.error(`Failed to load frame ${i}:`, error)
    }
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob)
    }, 'image/png')
  })
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
