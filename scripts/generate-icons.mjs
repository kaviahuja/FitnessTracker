import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '..', 'public')

// Clean dumbbell icon — green→blue gradient background, white dumbbell
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#30d158"/>
      <stop offset="100%" stop-color="#0071e3"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <!-- Left end cap -->
  <rect x="52" y="212" width="36" height="88" rx="18" fill="white"/>
  <!-- Left plate -->
  <rect x="88" y="182" width="68" height="148" rx="12" fill="white"/>
  <!-- Bar -->
  <rect x="156" y="234" width="200" height="44" rx="10" fill="white"/>
  <!-- Right plate -->
  <rect x="356" y="182" width="68" height="148" rx="12" fill="white"/>
  <!-- Right end cap -->
  <rect x="424" y="212" width="36" height="88" rx="18" fill="white"/>
</svg>`

const svgBuffer = Buffer.from(svg)

async function generate() {
  // 512x512 — main PWA icon + maskable
  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-512x512.png'))
  console.log('✓ pwa-512x512.png')

  // 192x192 — standard PWA icon
  await sharp(svgBuffer).resize(192, 192).png().toFile(path.join(publicDir, 'pwa-192x192.png'))
  console.log('✓ pwa-192x192.png')

  // 180x180 — Apple touch icon (used by Safari "Add to Home Screen")
  await sharp(svgBuffer).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'))
  console.log('✓ apple-touch-icon.png')

  // 32x32 favicon PNG
  await sharp(svgBuffer).resize(32, 32).png().toFile(path.join(publicDir, 'favicon.png'))
  console.log('✓ favicon.png')

  console.log('\nAll icons generated.')
}

generate().catch(console.error)
