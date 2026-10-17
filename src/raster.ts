import type { DrawingContext, ImageLike } from '@shared/draw'
import { PNG } from 'pngjs'

/** An image the raster backend can draw: decoded 8-bit RGBA pixels. */
export interface RasterImage extends ImageLike {
  data: Uint8Array
}

/** A `DrawingContext` backed by a plain pixel buffer; `toPng()` encodes the result. */
export interface RasterContext extends DrawingContext {
  toPng(): Buffer
}

interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

const CHANNELS = 4
const DIGIT_WIDTH = 5
const DIGIT_HEIGHT = 7
const DIGIT_SCALE = 2
const DIGIT_GAP = 1
const DIGIT_ADVANCE = DIGIT_WIDTH * DIGIT_SCALE + DIGIT_GAP

/** 5x7 digit bitmaps standing in for the browser's `20px monospace` count text. */
const DIGITS: Record<string, readonly string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
}

const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 255 }
const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 255 }
const NAMED_COLORS: Record<string, Rgba> = { black: BLACK, white: WHITE }

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const RGB_COLOR = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/
const HSL_COLOR = /^hsl\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*\)$/

export function decodePng(buffer: Uint8Array): RasterImage {
  const png = PNG.sync.read(asBuffer(buffer))
  return { width: png.width, height: png.height, data: png.data }
}

export function encodePng(image: RasterImage): Buffer {
  const png = new PNG({ width: image.width, height: image.height })
  png.data = asBuffer(image.data)
  return PNG.sync.write(png)
}

export function createRasterContext(): RasterContext {
  let width = 0
  let height = 0
  let data = new Uint8Array(0)
  let fill: Rgba = BLACK
  let style = 'black'
  let textAlign: DrawingContext['textAlign'] = 'start'

  function blend(x: number, y: number, color: Rgba): void {
    if (x < 0 || y < 0 || x >= width || y >= height) return

    const index = (y * width + x) * CHANNELS
    const sourceAlpha = color.a / 255
    const destAlpha = (data[index + 3] ?? 0) / 255
    const outAlpha = sourceAlpha + destAlpha * (1 - sourceAlpha)

    if (outAlpha === 0) return

    const channel = (source: number, destination: number): number =>
      Math.round((source * sourceAlpha + destination * destAlpha * (1 - sourceAlpha)) / outAlpha)

    data[index] = channel(color.r, data[index] ?? 0)
    data[index + 1] = channel(color.g, data[index + 1] ?? 0)
    data[index + 2] = channel(color.b, data[index + 2] ?? 0)
    data[index + 3] = Math.round(outAlpha * 255)
  }

  function fillArea(x: number, y: number, w: number, h: number, color: Rgba): void {
    for (let row = 0; row < h; row++) {
      for (let column = 0; column < w; column++) blend(x + column, y + row, color)
    }
  }

  return {
    drawImage(image, dx, dy, dw, dh) {
      const source = asRasterImage(image)
      if (dw <= 0 || dh <= 0 || source.width <= 0 || source.height <= 0) return

      for (let y = 0; y < dh; y++) {
        const sourceY = Math.min(source.height - 1, Math.floor((y * source.height) / dh))
        for (let x = 0; x < dw; x++) {
          const sourceX = Math.min(source.width - 1, Math.floor((x * source.width) / dw))
          const index = (sourceY * source.width + sourceX) * CHANNELS
          const alpha = source.data[index + 3] ?? 0
          if (alpha === 0) continue
          blend(dx + x, dy + y, {
            r: source.data[index] ?? 0,
            g: source.data[index + 1] ?? 0,
            b: source.data[index + 2] ?? 0,
            a: alpha,
          })
        }
      }
    },
    fillText(text, x, y) {
      const glyphs = [...text].map((character) => {
        const glyph = DIGITS[character]
        if (!glyph) {
          throw new Error(
            `(mineflayer-web-inventory) the screenshot raster backend cannot draw "${character}"`,
          )
        }
        return glyph
      })
      if (glyphs.length === 0) return

      const totalWidth = glyphs.length * DIGIT_ADVANCE - DIGIT_GAP
      let startX = x
      if (textAlign === 'end') startX = x - totalWidth
      else if (textAlign === 'center') startX = x - Math.round(totalWidth / 2)

      for (const [index, glyph] of glyphs.entries()) {
        const glyphX = startX + index * DIGIT_ADVANCE
        for (const [row, bits] of glyph.entries()) {
          for (let column = 0; column < DIGIT_WIDTH; column++) {
            if (bits[column] !== '1') continue
            fillArea(
              glyphX + column * DIGIT_SCALE,
              y - DIGIT_HEIGHT * DIGIT_SCALE + row * DIGIT_SCALE,
              DIGIT_SCALE,
              DIGIT_SCALE,
              fill,
            )
          }
        }
      }
    },
    fillRect(x, y, w, h) {
      fillArea(x, y, w, h, fill)
    },
    setSize(nextWidth, nextHeight) {
      width = nextWidth
      height = nextHeight
      data = new Uint8Array(width * height * CHANNELS)
    },
    // Matching the browser with smoothing disabled; the raster backend always
    // samples nearest-neighbour.
    imageSmoothingEnabled: true,
    // Only count digits are ever drawn; the fixed bitmap size stands in for the
    // em size, so the font value itself is unused.
    font: '',
    get fillStyle() {
      return style
    },
    set fillStyle(value: string) {
      fill = parseColor(value)
      style = value
    },
    get textAlign() {
      return textAlign
    },
    set textAlign(value) {
      textAlign = value
    },
    toPng() {
      if (width === 0 || height === 0) {
        throw new Error(
          '(mineflayer-web-inventory) the raster canvas has no size; drawWindow must run first',
        )
      }
      return encodePng({ width, height, data })
    },
  }
}

/** Views pngjs's Buffer arguments without copying the underlying pixels. */
function asBuffer(bytes: Uint8Array): Buffer {
  return bytes instanceof Buffer
    ? bytes
    : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

function asRasterImage(image: ImageLike): RasterImage {
  if ('data' in image && image.data instanceof Uint8Array) {
    return { width: image.width, height: image.height, data: image.data }
  }
  throw new Error(
    '(mineflayer-web-inventory) the raster backend can only draw decoded images; use decodePng',
  )
}

function parseColor(value: string): Rgba {
  const trimmed = value.trim().toLowerCase()

  const named = NAMED_COLORS[trimmed]
  if (named) return named

  const hex = HEX_COLOR.exec(trimmed)
  if (hex) {
    const digits = hex[1] ?? ''
    if (digits.length === 3) {
      return {
        r: Number.parseInt(digits[0] ?? '0', 16) * 17,
        g: Number.parseInt(digits[1] ?? '0', 16) * 17,
        b: Number.parseInt(digits[2] ?? '0', 16) * 17,
        a: 255,
      }
    }
    return {
      r: Number.parseInt(digits.slice(0, 2), 16),
      g: Number.parseInt(digits.slice(2, 4), 16),
      b: Number.parseInt(digits.slice(4, 6), 16),
      a: 255,
    }
  }

  const rgb = RGB_COLOR.exec(trimmed)
  if (rgb) {
    return {
      r: Math.min(255, Number.parseInt(rgb[1] ?? '0', 10)),
      g: Math.min(255, Number.parseInt(rgb[2] ?? '0', 10)),
      b: Math.min(255, Number.parseInt(rgb[3] ?? '0', 10)),
      a: 255,
    }
  }

  const hsl = HSL_COLOR.exec(trimmed)
  if (hsl) {
    return hslToRgba(
      Number.parseFloat(hsl[1] ?? '0'),
      Number.parseFloat(hsl[2] ?? '0'),
      Number.parseFloat(hsl[3] ?? '0'),
    )
  }

  throw new Error(
    `(mineflayer-web-inventory) the raster backend cannot parse the colour "${value}"`,
  )
}

function hslToRgba(hue: number, saturation: number, lightness: number): Rgba {
  const s = Math.min(100, Math.max(0, saturation)) / 100
  const l = Math.min(100, Math.max(0, lightness)) / 100
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const sector = (((hue % 360) + 360) % 360) / 60
  const second = chroma * (1 - Math.abs((sector % 2) - 1))

  const [r, g, b] =
    sector < 1
      ? [chroma, second, 0]
      : sector < 2
        ? [second, chroma, 0]
        : sector < 3
          ? [0, chroma, second]
          : sector < 4
            ? [0, second, chroma]
            : sector < 5
              ? [second, 0, chroma]
              : [chroma, 0, second]

  const offset = l - chroma / 2
  return {
    r: Math.round((r + offset) * 255),
    g: Math.round((g + offset) * 255),
    b: Math.round((b + offset) * 255),
    a: 255,
  }
}
