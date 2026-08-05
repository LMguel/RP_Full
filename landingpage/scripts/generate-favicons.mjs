import sharp from 'sharp'
import path from 'path'

const SRC = path.resolve('public/image/logo.webp')
const OUT = path.resolve('public')

const sizes = [
  { file: 'favicon-16x16.png', size: 16 },
  { file: 'favicon-32x32.png', size: 32 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'android-chrome-192x192.png', size: 192 },
  { file: 'android-chrome-512x512.png', size: 512 },
]

const trimmed = sharp(SRC).trim()

for (const { file, size } of sizes) {
  await trimmed
    .clone()
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(OUT, file))
  console.log('generated', file)
}
