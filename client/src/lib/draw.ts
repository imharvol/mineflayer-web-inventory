import type { ItemView, WindowMessage } from '@shared/messages'

/** The only canvas members the renderer uses — a fake satisfies it in tests. */
export interface DrawingContext {
  drawImage(image: ImageLike, dx: number, dy: number, dw: number, dh: number): void
  fillText(text: string, x: number, y: number): void
  fillRect(x: number, y: number, w: number, h: number): void
  setSize(width: number, height: number): void
  imageSmoothingEnabled: boolean
  font: string
  fillStyle: string
  textAlign: 'start' | 'center' | 'end'
}

export interface ImageLike {
  width: number
  height: number
}

export type SlotPosition = [number, number]

export type Coordinates = Record<string, Record<number, SlotPosition>>

export interface DrawDeps {
  coordinates: Coordinates
  loadImage(src: string): Promise<ImageLike>
}

const BACKGROUND_DIRECTORY = 'windows'
const ITEM_SIZE = 32
const COUNT_FONT = '20px monospace'
const SWATCH_HEIGHT = 3
const SWATCH_INSET = 3
const SWATCH_Y_OFFSET = 29

/** Ported from the v1 client as-is; only the drawing order is observable. */
export async function drawWindow(
  ctx: DrawingContext,
  window: WindowMessage,
  deps: DrawDeps,
): Promise<void> {
  const background = await deps.loadImage(`${BACKGROUND_DIRECTORY}/${window.type}.png`)
  ctx.setSize(background.width, background.height)
  ctx.drawImage(background, 0, 0, background.width, background.height)

  const coordinates = deps.coordinates[window.type]
  if (!coordinates) return

  for (const key in window.slots) {
    const item = window.slots[key]
    if (!item) continue

    const position = coordinates[item.slot]
    if (!item.texture || !position) continue

    let image: ImageLike
    try {
      image = await deps.loadImage(item.texture)
    } catch {
      continue
    }

    drawItem(ctx, item, image, position)
  }
}

function drawItem(
  ctx: DrawingContext,
  item: ItemView,
  image: ImageLike,
  position: SlotPosition,
): void {
  const [x, y] = position

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(image, x, y, ITEM_SIZE, ITEM_SIZE)

  if (item.count > 1) {
    ctx.font = COUNT_FONT
    ctx.textAlign = 'end'
    ctx.fillStyle = 'black'
    ctx.fillText(String(item.count), x + ITEM_SIZE + 1, y + ITEM_SIZE - 1)
    ctx.fillStyle = 'white'
    ctx.fillText(String(item.count), x + ITEM_SIZE, y + ITEM_SIZE - 2)
  }

  if (item.durabilityLeft != null) {
    ctx.fillStyle = 'black'
    ctx.fillRect(x + SWATCH_INSET, y + SWATCH_Y_OFFSET, 28, SWATCH_HEIGHT)
    ctx.fillStyle = `hsl(${Math.round(item.durabilityLeft * 120)}, 100%, 50%)`
    ctx.fillRect(x + SWATCH_INSET, y + SWATCH_Y_OFFSET, Math.round(item.durabilityLeft * 28), 2)
  }
}

/** Real-canvas adapter; DOM lives here and in components, nowhere else. */
export function createCanvasContext(canvas: HTMLCanvasElement): DrawingContext | null {
  const context = canvas.getContext('2d')
  if (!context) return null

  return {
    drawImage: (image, dx, dy, dw, dh) => {
      // deps.loadImage resolves HTMLImageElements; the cast documents the boundary.
      context.drawImage(image as CanvasImageSource, dx, dy, dw, dh)
    },
    fillText: (text, x, y) => context.fillText(text, x, y),
    fillRect: (x, y, w, h) => context.fillRect(x, y, w, h),
    setSize: (width, height) => {
      canvas.width = width
      canvas.height = height
    },
    get imageSmoothingEnabled() {
      return context.imageSmoothingEnabled
    },
    set imageSmoothingEnabled(value) {
      context.imageSmoothingEnabled = value
    },
    get font() {
      return context.font
    },
    set font(value) {
      context.font = value
    },
    get fillStyle() {
      return context.fillStyle as string
    },
    set fillStyle(value) {
      context.fillStyle = value
    },
    get textAlign() {
      return context.textAlign as DrawingContext['textAlign']
    },
    set textAlign(value) {
      context.textAlign = value
    },
  }
}

export function loadImage(src: string): Promise<ImageLike> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () => reject(new Error(`Unable to load image: ${src}`)))
    image.src = src
  })
}

/**
 * Draw-token guard: paints from superseded draws are dropped instead of racing
 * the current one (v1 let a slow image from an old window paint over a new one).
 */
export function createGuardedContext(
  target: DrawingContext,
  isCurrent: () => boolean,
): DrawingContext {
  return {
    drawImage: (image, dx, dy, dw, dh) => {
      if (isCurrent()) target.drawImage(image, dx, dy, dw, dh)
    },
    fillText: (text, x, y) => {
      if (isCurrent()) target.fillText(text, x, y)
    },
    fillRect: (x, y, w, h) => {
      if (isCurrent()) target.fillRect(x, y, w, h)
    },
    setSize: (width, height) => {
      if (isCurrent()) target.setSize(width, height)
    },
    get imageSmoothingEnabled() {
      return target.imageSmoothingEnabled
    },
    set imageSmoothingEnabled(value) {
      if (isCurrent()) target.imageSmoothingEnabled = value
    },
    get font() {
      return target.font
    },
    set font(value) {
      if (isCurrent()) target.font = value
    },
    get fillStyle() {
      return target.fillStyle
    },
    set fillStyle(value) {
      if (isCurrent()) target.fillStyle = value
    },
    get textAlign() {
      return target.textAlign
    },
    set textAlign(value) {
      if (isCurrent()) target.textAlign = value
    },
  }
}
