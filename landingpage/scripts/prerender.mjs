import { build } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const ssrOutDir = path.join(root, 'dist-ssr')

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
  const { render } = await import(pathToFileURL(entryPath).href)
  const appHtml = render()

  const indexPath = path.join(root, 'dist', 'index.html')
  let html = fs.readFileSync(indexPath, 'utf-8')

  if (!html.includes('<div id="root"></div>')) {
    throw new Error('Não encontrei <div id="root"></div> em dist/index.html — prerender abortado.')
  }

  html = html.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)
  fs.writeFileSync(indexPath, html)

  fs.rmSync(ssrOutDir, { recursive: true, force: true })

  console.log('Prerender concluído:', path.relative(root, indexPath))
}

main().catch((err) => {
  console.error('Falha no prerender:', err)
  process.exit(1)
})
