import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createRasterContext, decodePng, encodePng, type RasterImage } from './raster'

function makeImage(width: number, height: number, pixels: number[][]): RasterImage {
  return { width, height, data: Uint8Array.from(pixels.flat()) }
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

function countWhitePixels(image: RasterImage): number {
  let count = 0
  for (let index = 0; index < image.data.length; index += 4) {
    if (
      image.data[index] === 255 &&
      image.data[index + 1] === 255 &&
      image.data[index + 2] === 255 &&
      image.data[index + 3] === 255
    ) {
      count++
    }
  }
  return count
}

function backgroundBytes(name: string): Buffer {
  return fs.readFileSync(new URL(`../client/public/windows/${name}.png`, import.meta.url))
}

describe('decodePng / encodePng', () => {
  it('round-trips pixels, including partial alpha', () => {
    const original = makeImage(2, 2, [
      [255, 0, 0, 255],
      [0, 255, 0, 128],
      [0, 0, 255, 0],
      [255, 255, 0, 255],
    ])

    const decoded = decodePng(encodePng(original))

    expect(decoded.width).toBe(2)
    expect(decoded.height).toBe(2)
    expect([...decoded.data]).toEqual([...original.data])
  })

  it('decodes the shipped window backgrounds (palette PNGs included)', () => {
    const expected: Array<[string, number, number]> = [
      ['chest', 352, 334],
      ['crafting-table', 352, 332],
      ['furnace', 352, 332],
      ['inventory', 352, 332],
      ['inventory-slots', 352, 331],
      ['large-chest', 352, 442],
    ]

    for (const [name, width, height] of expected) {
      const decoded = decodePng(backgroundBytes(name))
      expect([name, decoded.width, decoded.height]).toEqual([name, width, height])
    }
  })
})

describe('createRasterContext', () => {
  it('samples nearest-neighbour when scaling an image up', () => {
    const source = makeImage(2, 2, [
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 255],
      [255, 255, 0, 255],
    ])
    const context = createRasterContext()
    context.setSize(4, 4)

    context.drawImage(source, 0, 0, 4, 4)
    const result = decodePng(context.toPng())

    expect(pixelAt(result, 0, 0)).toEqual([255, 0, 0, 255])
    expect(pixelAt(result, 1, 1)).toEqual([255, 0, 0, 255])
    expect(pixelAt(result, 3, 0)).toEqual([0, 255, 0, 255])
    expect(pixelAt(result, 0, 3)).toEqual([0, 0, 255, 255])
    expect(pixelAt(result, 3, 3)).toEqual([255, 255, 0, 255])
  })

  it('clips drawing to the canvas bounds', () => {
    const source = makeImage(2, 2, [
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 255],
      [255, 255, 0, 255],
    ])
    const context = createRasterContext()
    context.setSize(1, 1)

    context.drawImage(source, -1, -1, 2, 2)
    const result = decodePng(context.toPng())

    expect(pixelAt(result, 0, 0)).toEqual([255, 255, 0, 255])
  })

  it('rejects images that were not decoded by the raster backend', () => {
    const context = createRasterContext()
    context.setSize(1, 1)

    expect(() => context.drawImage({ width: 1, height: 1 }, 0, 0, 1, 1)).toThrow(
      /can only draw decoded images/,
    )
  })

  it('blends sources over opaque and transparent pixels', () => {
    const greenHalf = makeImage(1, 1, [[0, 255, 0, 128]])
    const redHalf = makeImage(1, 1, [[255, 0, 0, 128]])
    const context = createRasterContext()
    context.setSize(2, 1)
    context.fillStyle = 'rgb(255, 0, 0)'
    context.fillRect(0, 0, 1, 1)

    context.drawImage(greenHalf, 0, 0, 1, 1)
    context.drawImage(redHalf, 1, 0, 1, 1)
    const result = decodePng(context.toPng())

    expect(pixelAt(result, 0, 0)).toEqual([127, 128, 0, 255])
    expect(pixelAt(result, 1, 0)).toEqual([255, 0, 0, 128])
  })

  it('fills rectangles with the parsed fill styles used by the drawing code', () => {
    const context = createRasterContext()
    context.setSize(6, 1)

    const styles = ['hsl(60, 100%, 50%)', '#f00', '#00ff00', 'rgb(0, 0, 255)', 'black', 'white']
    for (const [index, style] of styles.entries()) {
      context.fillStyle = style
      context.fillRect(index, 0, 1, 1)
    }
    const result = decodePng(context.toPng())

    expect(pixelAt(result, 0, 0)).toEqual([255, 255, 0, 255])
    expect(pixelAt(result, 1, 0)).toEqual([255, 0, 0, 255])
    expect(pixelAt(result, 2, 0)).toEqual([0, 255, 0, 255])
    expect(pixelAt(result, 3, 0)).toEqual([0, 0, 255, 255])
    expect(pixelAt(result, 4, 0)).toEqual([0, 0, 0, 255])
    expect(pixelAt(result, 5, 0)).toEqual([255, 255, 255, 255])
  })

  it('rejects fill styles it cannot parse', () => {
    const context = createRasterContext()

    expect(() => {
      context.fillStyle = 'rebeccapurple'
    }).toThrow(/cannot parse the colour "rebeccapurple"/)
  })

  it('draws right-aligned count digits like the shadowed monospace text', () => {
    const context = createRasterContext()
    context.setSize(32, 16)
    context.fillStyle = 'white'
    context.textAlign = 'end'

    context.fillText('12', 30, 15)
    const result = decodePng(context.toPng())

    expect(countWhitePixels(result)).toBe(96)
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 32; x++) {
        const [r, g, b, a] = pixelAt(result, x, y)
        const lit = r === 255 && g === 255 && b === 255 && a === 255
        if (lit) expect(x >= 9 && x < 30 && y >= 1 && y < 15).toBe(true)
      }
    }
    expect(pixelAt(result, 29, 3)).toEqual([255, 255, 255, 255])
  })

  it('aligns digits from the left and the centre', () => {
    const context = createRasterContext()
    context.setSize(32, 16)
    context.fillStyle = 'white'
    context.textAlign = 'start'

    context.fillText('8', 0, 15)
    context.textAlign = 'center'
    context.fillText('8', 16, 15)
    const result = decodePng(context.toPng())

    let inStartCell = 0
    let inCentreCell = 0
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 32; x++) {
        const [r, g, b, a] = pixelAt(result, x, y)
        if (r !== 255 || g !== 255 || b !== 255 || a !== 255) continue
        if (x < 10) inStartCell++
        else inCentreCell++
      }
    }
    expect(inStartCell).toBe(68)
    expect(inCentreCell).toBe(68)
    expect(pixelAt(result, 9, 3)).toEqual([255, 255, 255, 255])
    expect(pixelAt(result, 19, 3)).toEqual([255, 255, 255, 255])
  })

  it('rejects characters it has no glyphs for', () => {
    const context = createRasterContext()
    context.setSize(4, 4)

    expect(() => context.fillText('a', 0, 0)).toThrow(/cannot draw "a"/)
  })

  it('clears the pixels when the canvas is resized', () => {
    const context = createRasterContext()
    context.setSize(2, 2)
    context.fillStyle = 'white'
    context.fillRect(0, 0, 2, 2)

    context.setSize(2, 2)
    const result = decodePng(context.toPng())

    expect(pixelAt(result, 0, 0)).toEqual([0, 0, 0, 0])
  })

  it('refuses to encode a canvas that was never sized', () => {
    expect(() => createRasterContext().toPng()).toThrow(/has no size/)
  })
})
