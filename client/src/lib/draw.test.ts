import type { ItemView, WindowMessage } from '@shared/messages'
import { describe, expect, it } from 'vitest'
import { createGuardedContext, type DrawDeps, type DrawingContext, drawWindow } from './draw'

interface Recording {
  calls: unknown[][]
  context: DrawingContext
}

function createRecordingContext(): Recording {
  const calls: unknown[][] = []
  const context: DrawingContext = {
    drawImage: (_image, dx, dy, dw, dh) => calls.push(['drawImage', dx, dy, dw, dh]),
    fillText: (text, x, y) => calls.push(['fillText', text, x, y]),
    fillRect: (x, y, w, h) => calls.push(['fillRect', x, y, w, h]),
    setSize: (width, height) => calls.push(['setSize', width, height]),
    imageSmoothingEnabled: true,
    font: '',
    fillStyle: '',
    textAlign: 'start',
  }
  return { calls, context }
}

function item(overrides: Partial<ItemView> = {}): ItemView {
  return { slot: 0, name: 'dirt', displayName: 'Dirt', count: 1, ...overrides }
}

function windowWith(slots: WindowMessage['slots']): WindowMessage {
  return { id: 0, type: 'inventory', slots }
}

const background = { width: 352, height: 332 }

function deps(overrides: Partial<DrawDeps> = {}): DrawDeps {
  return {
    coordinates: { inventory: { 36: [15, 283] } },
    loadImage: async (src) => (src.startsWith('windows/') ? background : { width: 16, height: 16 }),
    ...overrides,
  }
}

describe('drawWindow', () => {
  it('draws the background, then the item, count and durability in order', async () => {
    const { calls, context } = createRecordingContext()
    const message = windowWith({
      36: item({ slot: 36, count: 3, texture: 'data:image/png;base64,x', durabilityLeft: 0.5 }),
    })

    await drawWindow(context, message, deps())

    expect(calls).toEqual([
      ['setSize', 352, 332],
      ['drawImage', 0, 0, 352, 332],
      ['drawImage', 15, 283, 32, 32],
      ['fillText', '3', 48, 314],
      ['fillText', '3', 47, 313],
      ['fillRect', 18, 312, 28, 3],
      ['fillRect', 18, 312, 14, 2],
    ])
  })

  it('skips items without a texture or without coordinates', async () => {
    const { calls, context } = createRecordingContext()
    const message = windowWith({
      36: item({ slot: 36, texture: undefined }),
      37: item({ slot: 99, texture: 'data:image/png;base64,x' }),
      38: null,
    })

    await drawWindow(context, message, deps())

    expect(calls).toEqual([
      ['setSize', 352, 332],
      ['drawImage', 0, 0, 352, 332],
    ])
  })

  it('skips slots whose image fails to load', async () => {
    const { calls, context } = createRecordingContext()
    const message = windowWith({ 36: item({ slot: 36, texture: 'broken' }) })

    await drawWindow(
      context,
      message,
      deps({
        loadImage: async (src) => {
          if (src === 'broken') throw new Error('nope')
          return background
        },
      }),
    )

    expect(calls).toHaveLength(2)
  })

  it('rejects when the background image cannot be loaded', async () => {
    const { context } = createRecordingContext()

    await expect(
      drawWindow(
        context,
        windowWith({}),
        deps({
          loadImage: async () => {
            throw new Error('no background')
          },
        }),
      ),
    ).rejects.toThrow('no background')
  })

  it('does not draw a count for single items', async () => {
    const { calls, context } = createRecordingContext()
    const message = windowWith({
      36: item({ slot: 36, count: 1, texture: 'data:image/png;base64,x' }),
    })

    await drawWindow(context, message, deps())

    expect(calls.some(([name]) => name === 'fillText')).toBe(false)
  })
})

describe('createGuardedContext', () => {
  it('drops paints once the token is stale', async () => {
    const { calls, context } = createRecordingContext()
    const message = windowWith({ 36: item({ slot: 36, texture: 'data:image/png;base64,x' }) })

    await drawWindow(
      createGuardedContext(context, () => false),
      message,
      deps(),
    )

    expect(calls).toHaveLength(0)
  })

  it('paints through while the token is current', async () => {
    const { calls, context } = createRecordingContext()
    const message = windowWith({ 36: item({ slot: 36, texture: 'data:image/png;base64,x' }) })

    await drawWindow(
      createGuardedContext(context, () => true),
      message,
      deps(),
    )

    expect(calls.length).toBeGreaterThan(0)
  })
})
