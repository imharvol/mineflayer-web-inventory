/**
 * Serves the real plugin (with a fake bot) for the Playwright smoke test.
 * Commands come in on stdin, one per line:
 *   update <slot> <name> <count>
 *   custom <slot> <name> <count> <custom name…>
 *   clear <slot>
 *   quit
 */
import { EventEmitter } from 'node:events'
import type { Bot } from 'mineflayer'
import type { Item } from 'prismarine-item'
import inventoryViewer from '../../src/index'
import type { TrackerBot, TrackerWindow } from '../../src/tracker'

class FakeWindow extends EventEmitter implements TrackerWindow {
  readonly id: number
  type: string
  slots: (Item | null)[]
  readonly inventoryStart: number
  readonly inventoryEnd: number

  constructor(
    id: number,
    type: string,
    slotCount: number,
    inventoryStart: number,
    inventoryEnd: number,
  ) {
    super()
    this.id = id
    this.type = type
    this.slots = new Array(slotCount).fill(null)
    this.inventoryStart = inventoryStart
    this.inventoryEnd = inventoryEnd
  }

  updateSlot(slot: number, item: Item | null): void {
    if (item) item.slot = slot
    const oldItem = this.slots[slot] ?? null
    this.slots[slot] = item
    this.emit('updateSlot', slot, oldItem, item)
  }
}

class FakeBot extends EventEmitter implements TrackerBot {
  version = '1.18.2'
  inventory = new FakeWindow(0, 'minecraft:inventory', 46, 9, 45)
  currentWindow: TrackerWindow | null = null
}

function makeItem(name: string, count: number, displayName: string, customName?: string): Item {
  return {
    name,
    displayName,
    count,
    type: 1,
    metadata: 0,
    slot: 0,
    nbt: null,
    stackId: null,
    stackSize: 64,
    ...(customName === undefined ? {} : { customName }),
  } as Item
}

const port = Number(process.env.PORT ?? 0)
const bot = new FakeBot()

inventoryViewer(bot as unknown as Bot, { port, startOnLoad: false, windowUpdateDebounceTime: 30 })
const webInventory = (bot as unknown as Bot).webInventory
await webInventory.start()

bot.inventory.updateSlot(36, makeItem('dirt', 16, 'Dirt'))

console.log(`listening ${port}`)

process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk: string) => {
  for (const line of chunk.split('\n')) {
    handle(line.trim())
  }
})

function handle(line: string): void {
  const [command, ...args] = line.split(' ')
  if (command === 'update') {
    const [slot, name, count] = args
    if (slot === undefined || name === undefined || count === undefined) return
    const displayName = name.charAt(0).toUpperCase() + name.slice(1)
    bot.inventory.updateSlot(Number(slot), makeItem(name, Number(count), displayName))
    console.log(`updated ${name}`)
    return
  }
  if (command === 'custom') {
    const [slot, name, count, ...customNameParts] = args
    const customName = customNameParts.join(' ')
    if (slot === undefined || name === undefined || count === undefined || customName === '') return
    const displayName = name.charAt(0).toUpperCase() + name.slice(1)
    bot.inventory.updateSlot(Number(slot), makeItem(name, Number(count), displayName, customName))
    console.log(`custom ${name}`)
    return
  }
  if (command === 'clear') {
    const [slot] = args
    if (slot === undefined) return
    bot.inventory.updateSlot(Number(slot), null)
    console.log('cleared')
    return
  }
  if (command === 'quit') {
    process.exit(0)
  }
}
