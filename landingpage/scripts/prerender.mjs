import { build } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const ssrOutDir = path.join(root, 'dist-ssr')

function replaceHead(html, { title, description, path: routePath }) {
  const url = `https://www.registraponto.app.br${routePath}`
  return html
    .replace(/<title>.*?<\/title>/s, `<title>${title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/s, `$1${description}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/s, `$1${url}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/s, `$1${title}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/s, `$1${description}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/s, `$1${url}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/s, `$1${title}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/s, `$1${description}$2`)
}

async function main() {
  await build({
    root,
    plugins: [react()],
    logLevel: 'warn',
    build: {
      ssr: 'src/entry-server.jsx',
      outDir: 'dist-ssr',
      write: true,
      rollupOptions: { output: { format: 'es' } },
    },
  })

  const entryPath = path.join(ssrOutDir, 'entry-server.js')
  const { render, SEGMENTS } = await import(pathToFileURL(entryPath).href)

  const baseIndexPath = path.join(root, 'dist', 'index.html')
  const baseHtml = fs.readFileSync(baseIndexPath, 'utf-8')

  if (!baseHtml.includes('<div id="root"></div>')) {
    throw new Error('Não encontrei <div id="root"></div> em dist/index.html — prerender abortado.')
  }

  // Home ("/")
  const homeHtml = baseHtml.replace('<div id="root"></div>', `<div id="root">${render('/')}</div>`)
  fs.writeFileSync(baseIndexPath, homeHtml)
  console.log('Prerender concluído:', path.relative(root, baseIndexPath))

  // Segment pages
  for (const segment of SEGMENTS) {
    const appHtml = render(segment.path)
    let html = baseHtml.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)
    html = replaceHead(html, { title: segment.seo.title, description: segment.seo.description, path: segment.path })

    const outDir = path.join(root, 'dist', segment.slug)
    fs.mkdirSync(outDir, { recursive: true })
    const outFile = path.join(outDir, 'index.html')
    fs.writeFileSync(outFile, html)
    console.log('Prerender concluído:', path.relative(root, outFile))
  }

  fs.rmSync(ssrOutDir, { recursive: true, force: true })
}

main().catch((err) => {
  console.error('Falha no prerender:', err)
  process.exit(1)
})
