import type { DrawingContext, ImageLike } from '@shared/draw'

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
