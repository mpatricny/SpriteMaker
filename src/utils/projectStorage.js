/**
 * Project storage utilities using File System Access API
 */

/**
 * Check if File System Access API is supported
 */
export function isFileSystemAccessSupported() {
  return 'showDirectoryPicker' in window
}

/**
 * Save project to a directory
 * @param {Array} frames - Array of frame objects with url and metadata
 * @param {Object} settings - Export settings
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<void>}
 */
export async function saveProject(frames, settings, onProgress) {
  if (!isFileSystemAccessSupported()) {
    throw new Error('File System Access API is not supported in this browser. Please use Chrome or Edge.')
  }

  // Request directory access
  const dirHandle = await window.showDirectoryPicker({
    mode: 'readwrite',
    startIn: 'downloads',
  })

  const totalSteps = frames.length + 1 // frames + project.json
  let completedSteps = 0

  // Save each frame as PNG
  const frameMetadata = []

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    const filename = `frame-${String(i + 1).padStart(3, '0')}.png`

    // Fetch the blob from URL
    const response = await fetch(frame.url)
    const blob = await response.blob()

    // Create and write file
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(blob)
    await writable.close()

    // Store metadata
    frameMetadata.push({
      filename,
      index: frame.index,
      cropRegion: frame.cropRegion || null,
    })

    completedSteps++
    if (onProgress) {
      onProgress(Math.round((completedSteps / totalSteps) * 100))
    }
  }

  // Save project.json
  const projectData = {
    version: 1,
    createdAt: new Date().toISOString(),
    frames: frameMetadata,
    settings: {
      frameWidth: settings.frameWidth,
      frameHeight: settings.frameHeight,
      columns: settings.columns,
      padding: settings.padding,
    },
  }

  const projectFileHandle = await dirHandle.getFileHandle('project.json', { create: true })
  const projectWritable = await projectFileHandle.createWritable()
  await projectWritable.write(JSON.stringify(projectData, null, 2))
  await projectWritable.close()

  completedSteps++
  if (onProgress) {
    onProgress(100)
  }

  return dirHandle.name
}

/**
 * Load project from a directory
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<{frames: Array, settings: Object}>}
 */
export async function loadProject(onProgress) {
  if (!isFileSystemAccessSupported()) {
    throw new Error('File System Access API is not supported in this browser. Please use Chrome or Edge.')
  }

  // Request directory access
  const dirHandle = await window.showDirectoryPicker({
    mode: 'read',
    startIn: 'downloads',
  })

  // Read project.json
  let projectData
  try {
    const projectFileHandle = await dirHandle.getFileHandle('project.json')
    const projectFile = await projectFileHandle.getFile()
    const projectText = await projectFile.text()
    projectData = JSON.parse(projectText)
  } catch (error) {
    throw new Error('Folder does not contain a valid SpriteMaker project (missing project.json)')
  }

  if (!projectData.version || !projectData.frames) {
    throw new Error('Invalid project.json format')
  }

  const totalSteps = projectData.frames.length
  let completedSteps = 0

  // Load frame images
  const frames = []

  for (const frameMeta of projectData.frames) {
    try {
      const fileHandle = await dirHandle.getFileHandle(frameMeta.filename)
      const file = await fileHandle.getFile()
      const url = URL.createObjectURL(file)

      frames.push({
        id: `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        url,
        index: frameMeta.index,
        cropRegion: frameMeta.cropRegion,
      })
    } catch (error) {
      console.warn(`Failed to load ${frameMeta.filename}:`, error)
    }

    completedSteps++
    if (onProgress) {
      onProgress(Math.round((completedSteps / totalSteps) * 100))
    }
  }

  if (frames.length === 0) {
    throw new Error('Failed to load any frames')
  }

  return {
    frames,
    settings: projectData.settings,
    projectName: dirHandle.name,
  }
}
