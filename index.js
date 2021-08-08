const { getWindowName } = require('./utils')

const DEFAULT_VERSION = '1.16'

module.exports = function (bot, options) {
  options = options || {}
  const webPath = options.path || '/'
  const express = options.express || require('express')
  const app = options.app || express()
  const http = options.http || require('http').createServer(app)
  const io = options.io || require('socket.io')(http)
  const port = options.port || 3000
  const debounceTime = options.debounceTime || 100

  const path = require('path')
  const _ = require('lodash')

  bot.webInventory = {
    options,
    start,
    stop
  }

  // Try to load mcAssets
  let mcAssets = require('minecraft-assets')(bot.version)
  if (!mcAssets) {
    mcAssets = require('minecraft-assets')(DEFAULT_VERSION)
    if (mcAssets) {
      console.log(`(web-inventory) WARNING: Please, specify a bot.version or web-inventory may not work properly. Using version ${DEFAULT_VERSION} for minecraft-assets`)
    } else {
      console.log('(web-inventory) ERROR: Couldn\'t load minecraft-assets')
      return
    }
  }

  const publicPath = webPath.endsWith('/') ? webPath + 'public' : webPath + '/public'
  app.use(publicPath, express.static(path.join(__dirname, 'public')))

  app.get(webPath, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
  })

  io.on('connection', (socket) => {
    function addTexture (item) {
      if (!item) return item
      item.texture = mcAssets.textureContent[item.name].texture
      return item
    }
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
      }

      const slots = Object.assign({}, window.slots)
      for (const item in slots) {
        if (slots[item]) slots[item] = addTexture(slots[item])
      }
      windowUpdate.slots = slots
      socket.emit('window', windowUpdate)
    }

    // On connection sends the initial state of the current window or inventory if there's no window open
    emitWindow(bot.currentWindow ?? bot.inventory)

    // Updates are queued here to allow debouncing the 'windowUpdate' event
    let updateObject = { id: null, type: null, slots: {} }

    const debounceUpdate = _.debounce(() => {
      socket.emit('windowUpdate', updateObject)
      updateObject = { id: null, type: null, slots: {} }
    }, debounceTime)

    function update (slot, oldItem, newItem, window) {
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

      if (newItem) newItem = addTexture(newItem)

      updateObject.slots[slot] = newItem

      debounceUpdate()
    }
    bot.inventory.on('updateSlot', (slot, oldItem, newItem) => update(slot, oldItem, newItem, bot.inventory))

    const windowOpenHandler = (window) => {
      emitWindow(window)

      const windowUpdateHandler = (slot, oldItem, newItem) => {
        update(slot, oldItem, newItem, window)
      }
      window.on('updateSlot', windowUpdateHandler)

      window.once('close', () => {
        emitWindow(bot.inventory)
        window.removeListener('updateSlot', windowUpdateHandler)
      })
    }
    bot.on('windowOpen', windowOpenHandler)

    socket.once('disconnect', () => {
      debounceUpdate.cancel()
      bot.inventory.removeListener('updateSlot', update)
      bot.removeListener('windowOpen', windowOpenHandler)
    })
  })

  bot.once('end', () => {
    stop()
  })

  if (options.startOnLoad || options.startOnLoad == null) start() // Start the server by default when the plugin is loaded

  function start (cb) {
    cb = cb || noop
    if (bot.webInventory.isRunning) return cb(new Error('(web-inventory) INFO: web-inventory is already running'))

    http.listen(port, () => {
      bot.webInventory.isRunning = true
      console.log(`(web-inventory) INFO: Inventory web server running on *:${port}`)
      cb()
    })
  }

  function stop (cb) {
    cb = cb || noop
    if (!bot.webInventory.isRunning) return cb(new Error('(web-inventory) INFO: web-inventory is not running'))

    http.close(() => {
      bot.webInventory.isRunning = false
      console.log('(web-inventory) INFO: Inventory web server closed')
      cb()
    })
  }
}

function noop () {}
