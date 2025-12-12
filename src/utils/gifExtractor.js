import { parseGIF, decompressFrames } from 'gifuct-js'

export async function extractFramesFromGif(file, onProgress) {
  const buffer = await file.arrayBuffer()
  const gif = parseGIF(buffer)
  const gifFrames = decompressFrames(gif, true)

  const frames = []
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  canvas.width = gif.lsd.width
  canvas.height = gif.lsd.height

  for (let i = 0; i < gifFrames.length; i++) {
    const frame = gifFrames[i]

    const imageData = ctx.createImageData(frame.dims.width, frame.dims.height)
    imageData.data.set(frame.patch)

    if (frame.disposalType === 2) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = frame.dims.width
    tempCanvas.height = frame.dims.height
    tempCanvas.getContext('2d').putImageData(imageData, 0, 0)

    ctx.drawImage(tempCanvas, frame.dims.left, frame.dims.top)

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    const url = URL.createObjectURL(blob)

    frames.push({
      id: `frame-${i + 1}`,
      url,
      index: i,
      delay: frame.delay,
    })

    if (onProgress) {
      onProgress(Math.round(((i + 1) / gifFrames.length) * 100))
    }
  }

  return frames
}
