import sharp from 'sharp'
import path from 'path'

const OUT = path.resolve('public/og-image.png')
const LOGO = path.resolve('public/image/logo.webp')

const W = 1200
const H = 630

const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0C1A38"/>
      <stop offset="55%" stop-color="#12297A"/>
      <stop offset="100%" stop-color="#1847D6"/>
    </linearGradient>
    <radialGradient id="glow" cx="85%" cy="15%" r="60%">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#38BDF8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <text x="80" y="260" font-family="Arial, sans-serif" font-size="64" font-weight="800" fill="#FFFFFF">REGISTRA.PONTO</text>
  <text x="80" y="330" font-family="Arial, sans-serif" font-size="34" font-weight="600" fill="#BFD1FF">Feche a folha sem conflito.</text>
  <text x="80" y="378" font-family="Arial, sans-serif" font-size="34" font-weight="600" fill="#BFD1FF">Reconhecimento facial. Dashboard em tempo real.</text>
  <text x="80" y="470" font-family="Arial, sans-serif" font-size="24" font-weight="500" fill="#8FA8E8">Implantação em até 48h  •  Sem cartão  •  Sem senha</text>
</svg>
`

const logo = await sharp(LOGO).resize({ height: 150 }).toBuffer()

await sharp(Buffer.from(svg))
  .composite([{ input: logo, left: W - 150 - 90, top: 60 }])
  .png()
  .toFile(OUT)

console.log('og-image.png generated at', OUT)
