/* Plain-CJS consumer of the packed tarball: exercises the frozen contract. */
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { io } = require('socket.io-client')
const plugin = require('mineflayer-web-inventory')
const { addItemData, getWindowName } = require('mineflayer-web-inventory/utils')

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

  openWindow(window) {
    this.currentWindow = window
    this.emit('windowOpen', window)
  }
}

function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve))
}

function waitFor(predicate) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 5000
    const tick = () => {
      if (predicate()) return resolve()
      if (Date.now() > deadline) return reject(new Error('condition not met in time'))
      setTimeout(tick, 10)
    }
    tick()
  })
}

async function main() {
  assert.equal(typeof plugin, 'function', 'require() must return the plugin function')
  assert.equal(typeof getWindowName, 'function', './utils must expose getWindowName')
  assert.equal(typeof addItemData, 'function', './utils must expose addItemData')

  assert.equal(
    getWindowName({
      type: 'minecraft:chest',
      slots: Object.fromEntries(Array.from({ length: 63 }, (_, i) => [i, null])),
    }),
    'chest',
  )
  assert.equal(getWindowName({ type: 'minecraft:hopper', slots: {} }), null)

  const data = {
    version: { minecraftVersion: '1.12.2', '<=': () => true },
    itemsByName: { wool: {} },
    blocksByName: { wool: { variations: [{ metadata: 5, displayName: 'Lime Wool' }] } },
  }
  const assets = {
    directory: '/nonexistent',
    textureContent: { wool: { texture: 'data:image/png;base64,AAA' } },
  }
  const item = { type: 35, metadata: 5, count: 3, slot: 36, name: 'wool', displayName: 'Wool' }
  const view = addItemData(data, assets, item)
  assert.equal(view.displayName, 'Lime Wool')
  assert.equal(view.texture, 'data:image/png;base64,AAA')
  assert.equal(item.displayName, 'Wool', 'addItemData must not mutate its input')

  const port = 32123
  const bot = new FakeBot()
  plugin(bot, { port, windowUpdateDebounceTime: 20 })

  assert.equal(typeof bot.webInventory.start, 'function')
  assert.equal(typeof bot.webInventory.stop, 'function')
  assert.equal(bot.webInventory.options.port, port)
  assert.equal(bot.webInventory.options.host, '127.0.0.1')
  assert.ok(Object.isFrozen(bot.webInventory.options))

  await waitFor(() => bot.webInventory.isRunning)

  const socket = io(`http://127.0.0.1:${port}`, { path: '/socket.io', transports: ['websocket'] })
  const window = await once(socket, 'window')
  assert.equal(window.id, 0)
  assert.equal(window.type, 'inventory')
  assert.equal(Object.keys(window.slots).length, 46)
  assert.equal(window.slots[0], null)

  const updatePromise = once(socket, 'windowUpdate')
  bot.inventory.updateSlot(36, {
    name: 'dirt',
    displayName: 'Dirt',
    count: 16,
    type: 1,
    metadata: 0,
    slot: 36,
    nbt: null,
    stackId: null,
    stackSize: 64,
  })
  const update = await updatePromise
  assert.equal(update.id, 0)
  assert.equal(update.type, 'inventory')
  assert.equal(update.slots[36].name, 'dirt')
  assert.equal(update.slots[36].count, 16)
  assert.match(update.slots[36].texture, /^data:image\/png;base64,/)

  const screenshotPath = path.join(os.tmpdir(), `web-inventory-screenshot-${process.pid}.png`)
  const png = await bot.webInventory.screenshot({ path: screenshotPath })
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'screenshot must be a PNG')
  assert.equal(png.readUInt32BE(16), 352, 'inventory background width')
  assert.equal(png.readUInt32BE(20), 332, 'inventory background height')
  assert.ok(fs.readFileSync(screenshotPath).equals(png), 'the path option must write the PNG')
  fs.rmSync(screenshotPath)

  const unsupportedPromise = once(socket, 'window')
  bot.openWindow(new FakeWindow(3, 'minecraft:hopper', 41, 5, 41))
  const unsupported = await unsupportedPromise
  assert.equal(unsupported.unsupported, true)
  assert.equal(unsupported.id, 0)
  assert.equal(unsupported.type, 'inventory')
  assert.equal(unsupported.realId, 3)
  assert.equal(unsupported.realType, 'minecraft:hopper')
  assert.equal(Object.keys(unsupported.slots).length, 45)

  await bot.webInventory.stop()
  assert.equal(bot.webInventory.isRunning, false)
  await assert.rejects(() => bot.webInventory.stop(), /not running/)

  socket.disconnect()
  console.log('CJS OK')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
