import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ItemView, WindowMessage } from '@shared/messages'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { decodePng, encodePng, type RasterImage } from './raster'
import { createScreenshotRenderer } from './screenshot'

const BACKGROUND_COLOR = [10, 20, 30, 255]
const RED = [255, 0, 0, 255]
const GREEN = [0, 255, 0, 255]

function solidImage(width: number, height: number, color: number[]): RasterImage {
  const data = new Uint8Array(width * height * 4)
  for (let index = 0; index < data.length; index += 4) data.set(color, index)
  return { width, height, data }
}

function checkerImage(): RasterImage {
  return {
    width: 2,
    height: 2,
    data: Uint8Array.from([...RED, ...GREEN, ...RED, ...GREEN]),
  }
}

const textureUrl = `data:image/png;base64,${encodePng(checkerImage()).toString('base64')}`

function windowWith(overrides: Partial<ItemView> = {}): WindowMessage {
  return {
    id: 0,
    type: 'inventory',
    slots: {
      36: {
        slot: 36,
        name: 'dirt',
        displayName: 'Dirt',
        count: 5,
        texture: textureUrl,
        ...overrides,
      },
    },
  }
}

function pixelAt(image: RasterImage, x: number, y: number): number[] {
  const index = (y * image.width + x) * 4
  return [
    image.data[index] ?? 0,
    image.data[index + 1] ?? 0,
    image.data[index + 2] ?? 0,
    image.data[index + 3] ?? 0,
  ]
}

function countColor(image: RasterImage, color: number[]): number {
  let count = 0
  for (let index = 0; index < image.data.length; index += 4) {
    if (
      image.data[index] === color[0] &&
      image.data[index + 1] === color[1] &&
      image.data[index + 2] === color[2] &&
      image.data[index + 3] === color[3]
    ) {
      count++
    }
  }
  return count
}

describe('createScreenshotRenderer', () => {
  let assetsDir: string
  let emptyDir: string

  beforeAll(() => {
    assetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-inventory-screenshot-'))
    fs.mkdirSync(path.join(assetsDir, 'windows'))
    fs.writeFileSync(
      path.join(assetsDir, 'windows', 'inventory.png'),
      encodePng(solidImage(40, 40, BACKGROUND_COLOR)),
    )
    fs.writeFileSync(
      path.join(assetsDir, 'windows', 'coordinates.json'),
      JSON.stringify({ inventory: { 36: [4, 4] } }),
    )

    emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-inventory-screenshot-empty-'))
  })

  afterAll(() => {
    fs.rmSync(assetsDir, { recursive: true, force: true })
    fs.rmSync(emptyDir, { recursive: true, force: true })
  })

  it('renders the background and the item texture into a PNG', async () => {
    const renderer = createScreenshotRenderer(assetsDir)

    const buffer = await renderer.screenshot(windowWith())
    const image = decodePng(buffer)

    expect([image.width, image.height]).toEqual([40, 40])
    expect(pixelAt(image, 0, 0)).toEqual(BACKGROUND_COLOR)
    expect(pixelAt(image, 4, 4)).toEqual(RED)
    expect(pixelAt(image, 4, 21)).toEqual(RED)
    expect(pixelAt(image, 20, 20)).toEqual(GREEN)
    expect(pixelAt(image, 21, 21)).toEqual(GREEN)
    expect(pixelAt(image, 36, 36)).toEqual(BACKGROUND_COLOR)

    // The count text is the only white in the render: '5' is 17 lit glyph
    // pixels at scale 2.
    expect(countColor(image, [255, 255, 255, 255])).toBe(68)
  })

  it('draws the durability bar over the count text', async () => {
    const renderer = createScreenshotRenderer(assetsDir)

    const buffer = await renderer.screenshot(windowWith({ durabilityLeft: 0.5 }))
    const image = decodePng(buffer)

    // Lowest glyph row, above the bar.
    expect(pixelAt(image, 27, 20)).toEqual([255, 255, 255, 255])

    // The durability bar: a 28x3 black swatch with a half-width yellow fill.
    expect(pixelAt(image, 7, 33)).toEqual([255, 255, 0, 255])
    expect(pixelAt(image, 7, 35)).toEqual([0, 0, 0, 255])
    expect(pixelAt(image, 27, 33)).toEqual([0, 0, 0, 255])
  })

  it('does not draw a count for single items', async () => {
    const renderer = createScreenshotRenderer(assetsDir)

    const buffer = await renderer.screenshot(windowWith({ count: 1 }))
    const image = decodePng(buffer)

    expect(countColor(image, [255, 255, 255, 255])).toBe(0)
  })

  it('writes the PNG to the path option and returns the same bytes', async () => {
    const renderer = createScreenshotRenderer(assetsDir)
    const file = path.join(assetsDir, 'shot.png')

    const buffer = await renderer.screenshot(windowWith(), { path: file })

    expect(fs.readFileSync(file).equals(buffer)).toBe(true)
  })

  it('renders identical buffers on repeated calls', async () => {
    const renderer = createScreenshotRenderer(assetsDir)

    const first = await renderer.screenshot(windowWith({ durabilityLeft: 0.25 }))
    const second = await renderer.screenshot(windowWith({ durabilityLeft: 0.25 }))

    expect(first.equals(second)).toBe(true)
  })

  it('rejects with a build hint when the client assets are missing', async () => {
    const renderer = createScreenshotRenderer(emptyDir)

    await expect(renderer.screenshot(windowWith())).rejects.toThrow(/run "npm run build"/)
  })
})
