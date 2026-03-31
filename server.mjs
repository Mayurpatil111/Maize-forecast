import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const UPSTREAM_BASE_URL = process.env.UPSTREAM_BASE_URL || 'https://ardell-reusable-steven.ngrok-free.dev'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distDir = path.join(__dirname, 'dist')

const app = express()

app.get('/api/predict-maize', async (req, res) => {
  try {
    const upstreamUrl = new URL('/predict-maize', UPSTREAM_BASE_URL)
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === 'string' && v.trim() !== '') upstreamUrl.searchParams.set(k, v)
    }

    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        accept: 'application/json',
        'ngrok-skip-browser-warning': '1',
      },
    })

    const contentType = upstreamRes.headers.get('content-type') || 'application/json'
    const bodyText = await upstreamRes.text()

    res.status(upstreamRes.status)
    res.setHeader('content-type', contentType)
    res.setHeader('cache-control', 'no-store')
    res.send(bodyText)
  } catch (err) {
    res.status(502).json({
      error: 'Bad gateway',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.use(express.static(distDir))

// SPA fallback (Express v5 wildcard via regex). Keep AFTER /api routes.
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

const port = Number(process.env.PORT) || 3000
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${port}`)
})

