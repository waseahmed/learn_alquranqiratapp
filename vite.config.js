import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const audioDir = path.resolve(rootDir, 'audio')

const AUDIO_MIME = {
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
}

function isInsideAudioDir(filePath) {
  const resolved = path.resolve(filePath)
  const root = audioDir.endsWith(path.sep) ? audioDir : audioDir + path.sep
  return resolved === audioDir || resolved.startsWith(root)
}

function sendAudioFile(req, res, next) {
  const rel = decodeURIComponent((req.url || '/').split('?')[0].replace(/^\/+/, ''))
  if (!rel) return next()

  const filePath = path.resolve(audioDir, rel)
  if (!isInsideAudioDir(filePath)) {
    res.statusCode = 403
    res.end('Forbidden')
    return
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return next()

    const ext = path.extname(filePath).toLowerCase()
    const mime = AUDIO_MIME[ext] || 'application/octet-stream'
    const range = req.headers.range

    res.setHeader('Content-Type', mime)
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=3600')

    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range)
      const start = match && match[1] ? Number(match[1]) : 0
      const end = match && match[2] ? Number(match[2]) : stat.size - 1
      if (start >= stat.size || end >= stat.size || start > end) {
        res.statusCode = 416
        res.setHeader('Content-Range', `bytes */${stat.size}`)
        res.end()
        return
      }
      res.statusCode = 206
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`)
      res.setHeader('Content-Length', end - start + 1)
      if (req.method === 'HEAD') {
        res.end()
        return
      }
      fs.createReadStream(filePath, { start, end }).pipe(res)
      return
    }

    res.setHeader('Content-Length', stat.size)
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    fs.createReadStream(filePath).pipe(res)
  })
}

/** Serve ./audio at /audio during vite dev and preview (not copied into dist). */
function serveLocalAudioPlugin() {
  return {
    name: 'serve-local-audio',
    configureServer(server) {
      server.middlewares.use('/audio', sendAudioFile)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/audio', sendAudioFile)
    },
  }
}

// Custom domain (learn.alquranqiratacademy.com) serves from site root.
export default defineConfig({
  plugins: [react(), serveLocalAudioPlugin()],
  base: '/',
  build: {
    // Full local Quran text (~1.4MB) is intentionally bundled.
    chunkSizeWarningLimit: 2000,
  },
  optimizeDeps: {
    holdUntilCrawlEnd: false,
  },
  server: {
    fs: {
      allow: [rootDir, audioDir],
    },
  },
})
