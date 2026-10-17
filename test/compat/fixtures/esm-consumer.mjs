/* ESM consumer of the packed tarball. */
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import plugin from 'mineflayer-web-inventory'
import { getWindowName } from 'mineflayer-web-inventory/utils'
import { io } from 'socket.io-client'

class FakeWindow extends EventEmitter {
  constructor(id, type, slotCount, inventoryStart, inventoryEnd) {
    super()
    this.id = id
    this.type = type
    this.slots = new Array(slotCount).fill(null)
    this.inventoryStart = inventoryStart
    this.inventoryEnd = inventoryEnd
  }

  updateSlot(slot, item) {
    if (item) item.slot = slot
    const oldItem = this.slots[slot] ?? null
    this.slots[slot] = item
    this.emit('updateSlot', slot, oldItem, item)
  }
}

class FakeBot extends EventEmitter {
  constructor() {
    super()
    this.version = '1.18.2'
    this.inventory = new FakeWindow(0, 'minecraft:inventory', 46, 9, 45)
    this.currentWindow = null
  }
}

function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve))
}

assert.equal(typeof plugin, 'function', 'default import must be the plugin function')
assert.equal(getWindowName({ type: 'minecraft:furnace', slots: {} }), 'furnace')

const port = 32124
const bot = new FakeBot()
plugin(bot, { port, startOnLoad: false })

await bot.webInventory.start()

const socket = io(`http://127.0.0.1:${port}`, { path: '/socket.io', transports: ['websocket'] })
const window = await once(socket, 'window')
assert.equal(window.type, 'inventory')
assert.equal(Object.keys(window.slots).length, 46)

const png = await bot.webInventory.screenshot()
assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'screenshot must be a PNG')
assert.equal(png.readUInt32BE(16), 352)
assert.equal(png.readUInt32BE(20), 332)

await bot.webInventory.stop()
assert.equal(bot.webInventory.isRunning, false)

socket.disconnect()
console.log('ESM OK')
