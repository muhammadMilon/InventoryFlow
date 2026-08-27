/**
 * Rasterises `src/app/icon.svg` into the icon files browsers still ask for.
 *
 * The SVG is the source of truth — it is the same stacked-crate glyph as
 * `components/layout/brand.tsx`, so the tab icon and the in-app wordmark can
 * never drift apart. Everything else here is generated:
 *
 *   src/app/apple-icon.png   180×180, iOS home screen (Safari ignores SVG here)
 *   public/favicon.ico       16/32/48, for clients that request /favicon.ico
 *                            directly instead of reading the <link> tag
 *
 * Run with `npm run icons` after changing the SVG.
 */
import { Buffer } from 'node:buffer'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'src', 'app', 'icon.svg')

/** ICO sizes. 48 is what Windows uses for shortcuts and taskbar pins. */
const ICO_SIZES = [16, 32, 48]
const APPLE_SIZE = 180

const render = async (svg, size) =>
  sharp(svg, { density: 384 }).resize(size, size, { fit: 'contain' }).png({ compressionLevel: 9 }).toBuffer()

/**
 * Builds an .ico containing PNG-compressed frames.
 *
 * Layout: a 6-byte ICONDIR, then one 16-byte ICONDIRENTRY per frame, then the
 * frame payloads. The format is old enough that the header stores width and
 * height in a single byte each, which is why 256 is encoded as 0.
 */
function buildIco(frames) {
  const HEADER = 6
  const ENTRY = 16

  const dir = Buffer.alloc(HEADER)
  dir.writeUInt16LE(0, 0) // reserved
  dir.writeUInt16LE(1, 2) // 1 = icon
  dir.writeUInt16LE(frames.length, 4)

  let offset = HEADER + ENTRY * frames.length

  const entries = frames.map(({ size, data }) => {
    const entry = Buffer.alloc(ENTRY)
    entry.writeUInt8(size >= 256 ? 0 : size, 0) // width
    entry.writeUInt8(size >= 256 ? 0 : size, 1) // height
    entry.writeUInt8(0, 2) // palette size — 0 for truecolour
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // colour planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += data.length
    return entry
  })

  return Buffer.concat([dir, ...entries, ...frames.map((frame) => frame.data)])
}

async function main() {
  const svg = await readFile(source)

  const icoFrames = await Promise.all(
    ICO_SIZES.map(async (size) => ({ size, data: await render(svg, size) })),
  )

  await mkdir(path.join(root, 'public'), { recursive: true })
  await writeFile(path.join(root, 'public', 'favicon.ico'), buildIco(icoFrames))
  await writeFile(path.join(root, 'src', 'app', 'apple-icon.png'), await render(svg, APPLE_SIZE))

  const report = [...ICO_SIZES.map((s) => `${s}×${s}`)].join(', ')
  process.stdout.write(`icons written — favicon.ico (${report}), apple-icon.png (${APPLE_SIZE}×${APPLE_SIZE})\n`)
}

main().catch((error) => {
  process.stderr.write(`icon generation failed: ${error.message}\n`)
  process.exit(1)
})
