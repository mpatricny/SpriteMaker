# SpriteMaker

A browser-based tool for creating sprite sheets from videos and GIFs, with AI-powered background removal.

**Live Demo:** [https://spritemaker.pages.dev](https://spritemaker.pages.dev)

## Features

- **Sprite Sheet Maker**: Extract frames from video (MP4, WebM, MOV) or GIF files
  - Drag and drop file upload
  - Frame selection and reordering
  - Auto-crop to content boundaries
  - Horizontal flip
  - AI-powered background removal
  - Manual crop editor
  - Configurable sprite sheet layout (columns, padding, frame size)
  - Real-time preview with animation playback
  - Export as PNG

- **Background Remover**: Remove backgrounds from single images using AI
  - Supports PNG, JPG, WEBP and other formats
  - Download result as PNG with transparency

## Browser Requirements

- **Recommended:** Chrome or Edge (latest versions)
- Firefox and Safari: Basic functionality works, but Save/Load Project features require File System Access API (Chrome/Edge only)
- WebAssembly support required for video processing

## Technology

This is a client-side web application - all processing happens in your browser:

- **React 19** with Vite
- **FFmpeg WASM** for video frame extraction
- **@imgly/background-removal** for AI-powered background removal
- **@dnd-kit** for drag-and-drop functionality

No server-side processing required. Your files never leave your device.

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

The app is configured for Cloudflare Pages deployment with the required COOP/COEP headers for SharedArrayBuffer support (needed by FFmpeg WASM).

## License

MIT
