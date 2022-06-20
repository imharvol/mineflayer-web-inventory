const { getWindowName, addItemData } = require('./utils')

const DEFAULT_VERSION = '1.18'

module.exports = function (bot, options = {}) {
  options.webPath = options.webPath ?? options.path ?? '/'
  const express = options.express ?? require('express')
  const app = options.app ?? express()
  const http = options.http ?? require('http').createServer(app)
  const io = options.io ?? require('socket.io')(http)
  options.port = options.port ?? 3000
  options.windowUpdateDebounceTime = options.windowUpdateDebounceTime ?? options.debounceTime ?? 100

  if (!options.webPath.startsWith('/')) options.webPath = '/' + options.webPath

  const path = require('path')
  const _ = require('lodash')

  bot.webInventory = {
    options,
    isRunning: false
  }

  const start = () => {
    return new Promise((resolve, reject) => {
      if (bot.webInventory.isRunning) return reject(new Error('(mineflayer-web-inventory) INFO: mineflayer-web-inventory is already running'))

      http.listen(options.port, () => {
        bot.webInventory.isRunning = true
        console.log(`(mineflayer-web-inventory) INFO: Inventory web server running on *:${options.port}`)
        resolve()
      })
    })
  }

  const stop = () => {
    return new Promise((resolve, reject) => {
      if (!bot.webInventory.isRunning) return reject(new Error('(mineflayer-web-inventory) INFO: mineflayer-web-inventory is not running'))

      http.close(() => {
        bot.webInventory.isRunning = false
        console.log('(mineflayer-web-inventory) INFO: Inventory web server closed')
        resolve()
      })
    })
  }

  // Try to load mcData
  let mcData = require('minecraft-data')(bot.version)
  if (!mcData) {
    mcData = require('minecraft-assets')(DEFAULT_VERSION)
    if (mcData) {
      console.log(`(mineflayer-web-inventory) WARNING: Please, specify a bot.version or mineflayer-web-inventory may not work properly. Using version ${DEFAULT_VERSION} for minecraft-mcData`)
    } else {
      console.log('(mineflayer-web-inventory) ERROR: Unable to load minecraft-mcData')
      return
    }
  }

  // Try to load mcAssets
  let mcAssets = require('minecraft-assets')(bot.version)
  if (!mcAssets) {
    mcAssets = require('minecraft-assets')(DEFAULT_VERSION)
    if (mcAssets) {
      console.log(`(mineflayer-web-inventory) WARNING: Please, specify a bot.version or mineflayer-web-inventory may not work properly. Using version ${DEFAULT_VERSION} for minecraft-assets`)
    } else {
      console.log('(mineflayer-web-inventory) ERROR: Couldn\'t load minecraft-assets')
      return
    }
  }

  app.use(options.webPath, express.static(path.join(__dirname, 'client', 'public')))

  io.on('connection', (socket) => {
    function emitWindow (window) {
      // Use a copy of window to avoid modifying the internal state of mineflayer
      window = Object.assign({}, window)

      const windowUpdate = { id: window.id, type: getWindowName(window), slots: {} }

      // If the window is not supported, we transform it into a inventory update
      if (!windowUpdate.type) {
        windowUpdate.id = bot.inventory.id
        windowUpdate.type = getWindowName(bot.inventory)
        window.slots = Array(9).fill(null, 0, 9).concat(window.slots.slice(window.inventoryStart, window.inventoryEnd)) // The 9 empty slots that we add are the armor and crafting slots that are not included in inventoryStart and inventoryEnd
        window.slots.forEach(item => { if (item) item.slot -= window.inventoryStart - 9 })

        windowUpdate.unsupported = true
        windowUpdate.realId = window.id
        windowUpdate.realType = window.type
      }

      const slots = Object.assign({}, window.slots)
      for (const item in slots) {
        if (slots[item]) slots[item] = addItemData(mcData, mcAssets, slots[item])
      }
      windowUpdate.slots = slots
      socket.emit('window', windowUpdate)
    }

    // On connection sends the initial state of the current window or inventory if there's no window open
    emitWindow(bot.currentWindow ?? bot.inventory)

    // Updates are queued here to allow debouncing the 'windowUpdate' event
    const defaultUpdateObject = { id: null, type: null, slots: {} }
    let updateObject = defaultUpdateObject

    const debounceUpdate = _.debounce(() => {
      socket.emit('windowUpdate', updateObject)
      updateObject = defaultUpdateObject
    }, bot.webInventory.options.windowUpdateDebounceTime)

    function update (slot, oldItem, newItem, window) {
      const originalSlot = slot
      // Use copies of oldItem and newItem to avoid modifying the internal state of mineflayer
      if (oldItem) oldItem = Object.assign({}, oldItem)
      if (newItem) newItem = Object.assign({}, newItem)

      if (!getWindowName(window)) { // If the update comes from an unsupported window, we transform it into a inventory update
        updateObject.id = bot.inventory.id
        updateObject.type = getWindowName(bot.inventory)

        slot -= window.inventoryStart - 9
        if (newItem) newItem.slot = slot
      } else {
        // If the update comes from a window different to the current window, we can just ignore it
        if (bot.currentWindow && window.id !== bot.currentWindow.id) return

        // If the window has changed but there are updates from the older window still on the queue, we can just scrap those
        if ((bot.currentWindow ?? bot.inventory).id !== updateObject.id) {
          updateObject.id = window.id
          updateObject.type = getWindowName(window)
          updateObject.slots = {}
        }
      }

      if (newItem) {
        newItem.durabilityUsed = window.slots[originalSlot]?.durabilityUsed
        newItem = addItemData(mcData, mcAssets, newItem)
      }

      updateObject.slots[slot] = newItem

      debounceUpdate()
    }
    bot.inventory.on('updateSlot', (slot, oldItem, newItem) => update(slot, oldItem, newItem, bot.inventory))

    let previousWindow
    const windowOpenHandler = (window) => {
      const windowUpdateHandler = (slot, oldItem, newItem) => {
        update(slot, oldItem, newItem, window)
      }
      const windowCloseHandler = () => {
        emitWindow(bot.inventory)
        window.removeListener('updateSlot', windowUpdateHandler)
      }

      // Remove previous listeners
      if (previousWindow && previousWindow.id !== bot.inventory.id) {
        previousWindow.removeListener('updateSlot', windowUpdateHandler)
        previousWindow.removeListener('close', windowCloseHandler)
      }
      previousWindow = window

      emitWindow(window)

      window.on('updateSlot', windowUpdateHandler)
      window.once('close', windowCloseHandler)
    }
    bot.on('windowOpen', windowOpenHandler)

    socket.once('disconnect', () => {
      debounceUpdate.cancel()
      bot.inventory.removeListener('updateSlot', update)
      bot.removeListener('windowOpen', windowOpenHandler)
    })
  })

  bot.once('end', stop)

  if (options.startOnLoad !== false) start() // Start the server by default when the plugin is loaded

  bot.webInventory = {
    ...bot.webInventory,
    start,
    stop
  }
}
