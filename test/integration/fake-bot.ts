import { EventEmitter } from 'node:events'
import type { Item } from 'prismarine-item'
import type { TrackerBot, TrackerWindow } from '../../src/tracker'

export interface FakeWindowOptions {
  id: number
  type: string
  slotCount: number
  inventoryStart: number
  inventoryEnd: number
}

/**
 * The minimal prismarine Window surface the plugin touches. `inventoryEnd` is
 * exclusive, matching prismarine-windows where `Window.inventoryEnd` is the
 * declared inclusive end plus one.
 */
export class FakeWindow extends EventEmitter implements TrackerWindow {
  readonly id: number
  type: string
  slots: (Item | null)[]
  readonly inventoryStart: number
  readonly inventoryEnd: number

  constructor(options: FakeWindowOptions) {
    super()
    this.id = options.id
    this.type = options.type
    this.slots = new Array(options.slotCount).fill(null)
    this.inventoryStart = options.inventoryStart
    this.inventoryEnd = options.inventoryEnd
  }

  updateSlot(slot: number, item: Item | null): void {
    if (item) item.slot = slot
    const oldItem = this.slots[slot] ?? null
    this.slots[slot] = item
    this.emit('updateSlot', slot, oldItem, item)
  }
}

export class FakeBot extends EventEmitter implements TrackerBot {
  version: string
  inventory: FakeWindow
  currentWindow: TrackerWindow | null = null

  constructor(options: { version?: string } = {}) {
    super()
    this.version = options.version ?? '1.18.2'
    this.inventory = new FakeWindow({
      id: 0,
      type: 'minecraft:inventory',
      slotCount: 46,
      inventoryStart: 9,
      inventoryEnd: 45,
    })
  }

  openWindow(window: FakeWindow): void {
    this.currentWindow = window
    this.emit('windowOpen', window)
  }

  closeWindow(window: FakeWindow): void {
    if (this.currentWindow === window) this.currentWindow = null
    this.emit('windowClose', window)
  }

  quit(): void {
    this.emit('end')
  }
}

export function createChestWindow(id: number): FakeWindow {
  return new FakeWindow({
    id,
    type: 'minecraft:generic_9x3',
    slotCount: 63,
    inventoryStart: 27,
    inventoryEnd: 63,
  })
}

export function createHopperWindow(id: number): FakeWindow {
  return new FakeWindow({
    id,
    type: 'minecraft:hopper',
    slotCount: 41,
    inventoryStart: 5,
    inventoryEnd: 41,
  })
}
