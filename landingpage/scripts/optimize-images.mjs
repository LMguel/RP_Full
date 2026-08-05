import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const DIR = path.resolve('public/image')

const jobs = [
  { file: 'banner.png',      maxWidth: 1800, quality: 78 },
  { file: 'captura.png',     maxWidth: 1000, quality: 80 },
  { file: 'chatbot_rh.png',  maxWidth: 1400, quality: 80 },
  { file: 'dashboard.png',   maxWidth: 1600, quality: 80 },
  { file: 'espelho.png',     maxWidth: 1600, quality: 80 },
  { file: 'excel.png',       maxWidth: 1600, quality: 80 },
  { file: 'folha.png',       maxWidth: 1400, quality: 80 },
  { file: 'logo.png',        maxWidth: 480,  quality: 90 },
]

for (const { file, maxWidth, quality } of jobs) {
  const input = path.join(DIR, file)
  const output = path.join(DIR, file.replace('.png', '.webp'))
  const before = fs.statSync(input).size
  await sharp(input)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality })
    .toFile(output)
  const after = fs.statSync(output).size
  console.log(`${file} -> ${path.basename(output)}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB`)
}
