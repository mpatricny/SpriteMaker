import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

let ffmpeg = null
let loaded = false
let loading = false

export async function getFFmpeg(onLoadProgress) {
  if (ffmpeg && loaded) {
    return ffmpeg
  }

  if (loading) {
    while (loading) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return ffmpeg
  }

  loading = true
  ffmpeg = new FFmpeg()

  ffmpeg.on('log', ({ message }) => {
    console.log('[FFmpeg Log]', message)
  })

  try {
    console.log('[FFmpeg] Starting load...')
    if (onLoadProgress) onLoadProgress(10)

    // Try loading with default configuration first
    await ffmpeg.load()

    console.log('[FFmpeg] Loaded successfully!')
    if (onLoadProgress) onLoadProgress(100)
    loaded = true
  } catch (error) {
    console.error('[FFmpeg] Default load failed:', error)

    // Try with explicit CDN URLs
    try {
      console.log('[FFmpeg] Trying with explicit CDN URLs...')
      if (onLoadProgress) onLoadProgress(20)

      await ffmpeg.load({
        coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
        wasmURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
      })

      console.log('[FFmpeg] Loaded with CDN URLs!')
      if (onLoadProgress) onLoadProgress(100)
      loaded = true
    } catch (cdnError) {
      console.error('[FFmpeg] CDN load failed:', cdnError)
      loading = false
      throw new Error('Failed to load FFmpeg. Try using a GIF file instead of video.')
    }
  }

  loading = false
  return ffmpeg
}

export async function extractFramesFromVideo(file, fps = 10, onProgress) {
  console.log('[FFmpeg] Starting extraction for:', file.name)
  if (onProgress) onProgress(0)

  let ffmpegInstance
  try {
    ffmpegInstance = await getFFmpeg((p) => {
      console.log('[FFmpeg] Load progress:', p)
      if (onProgress) onProgress(Math.round(p * 0.3))
    })
  } catch (error) {
    console.error('[FFmpeg] Failed to get instance:', error)
    throw error
  }

  const inputName = 'input' + getExtension(file.name)
  console.log('[FFmpeg] Input name:', inputName)

  if (onProgress) onProgress(35)

  try {
    console.log('[FFmpeg] Writing file to virtual FS...')
    const fileData = await fetchFile(file)
    console.log('[FFmpeg] File size:', fileData.byteLength)
    await ffmpegInstance.writeFile(inputName, fileData)
    console.log('[FFmpeg] File written successfully')
  } catch (error) {
    console.error('[FFmpeg] Failed to write file:', error)
    throw new Error('Failed to load video file: ' + error.message)
  }

  if (onProgress) onProgress(40)

  ffmpegInstance.on('progress', ({ progress, time }) => {
    console.log('[FFmpeg] Extraction progress:', progress, 'time:', time)
    if (onProgress) {
      onProgress(40 + Math.round(progress * 50))
    }
  })

  try {
    // Check if we should preserve alpha channel (for MOV/ProRes and WebM files)
    const fileName = file.name.toLowerCase()
    const shouldPreserveAlpha = fileName.endsWith('.mov') || fileName.endsWith('.webm')

    console.log('[FFmpeg] Starting extraction with fps:', fps, 'preserveAlpha:', shouldPreserveAlpha)

    const ffmpegArgs = shouldPreserveAlpha
      ? ['-i', inputName, '-vf', `fps=${fps}`, '-pix_fmt', 'rgba', 'frame%04d.png']
      : ['-i', inputName, '-vf', `fps=${fps}`, 'frame%04d.png']

    await ffmpegInstance.exec(ffmpegArgs)
    console.log('[FFmpeg] Extraction completed')
  } catch (error) {
    console.error('[FFmpeg] Extraction failed:', error)
    throw new Error('Failed to extract frames: ' + error.message)
  }

  if (onProgress) onProgress(90)

  const frames = []
  let frameIndex = 1

  console.log('[FFmpeg] Reading extracted frames...')
  while (true) {
    const frameName = `frame${String(frameIndex).padStart(4, '0')}.png`
    try {
      const data = await ffmpegInstance.readFile(frameName)
      const blob = new Blob([data.buffer], { type: 'image/png' })
      const url = URL.createObjectURL(blob)
      frames.push({
        id: `frame-${frameIndex}`,
        url,
        index: frameIndex - 1,
      })
      await ffmpegInstance.deleteFile(frameName)
      frameIndex++
    } catch {
      break
    }
  }

  console.log('[FFmpeg] Total frames extracted:', frames.length)

  try {
    await ffmpegInstance.deleteFile(inputName)
  } catch (e) {
    console.warn('[FFmpeg] Could not delete input file:', e)
  }

  if (onProgress) onProgress(100)

  if (frames.length === 0) {
    throw new Error('Failed to extract any frames from video')
  }

  return frames
}

function getExtension(filename) {
  const ext = filename.split('.').pop()
  return ext ? `.${ext}` : ''
}
