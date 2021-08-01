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

  // TODO: This should be path.join(webPath, 'public')
  app.use('/public', express.static(path.join(__dirname, 'public')))

  app.get(webPath, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
  })

  io.on('connection', (socket) => {
    // On connection sends the initial state of the current window ?? inventory. Also adds each item's texture
    const initialSlots = {}
    const initialWindow = bot.currentWindow ?? bot.inventory
    const initialItems = bot.currentWindow?.items() ?? bot.inventory.itemsRange(0, bot.inventory.inventoryEnd)
    for (const item in initialItems) { // TODO: Try to simplify this
      initialItems[item].texture = mcAssets.textureContent[initialItems[item].name].texture
      initialSlots[initialItems[item].slot] = initialItems[item]
    }
    socket.emit('window', { id: initialWindow.id, type: initialWindow.type, slots: initialSlots })

    let updateObject = { id: null, type: null, slots: {} }

    const debounceUpdate = _.debounce(() => {
      socket.emit('windowUpdate', updateObject)
      updateObject = { id: null, type: null, slots: {} }
    }, debounceTime)

    function update (slot, oldItem, newItem, window) {
      if (bot.currentWindow && window.id !== bot.currentWindow.id) return

      // Use copies of oldItem and newItem to avoid modifying the internal state of mineflayerº
      if (oldItem) oldItem = Object.assign({}, oldItem)
      if (newItem) newItem = Object.assign({}, newItem)

      // Add item texture
      if (newItem) newItem.texture = mcAssets.textureContent[newItem.name].texture

      if (updateObject.id == null && updateObject.type == null) {
        updateObject.id = window.id
        updateObject.type = window.type
      } else if (updateObject.id !== window.id || updateObject.type !== window.type) return

      updateObject.slots[slot] = newItem

      debounceUpdate()
    }
    bot.inventory.on('updateSlot', (slot, oldItem, newItem) => update(slot, oldItem, newItem, bot.inventory))

    const windowOpenHandler = (window) => {
      const windowUpdateHandler = (slot, oldItem, newItem) => {
        update(slot, oldItem, newItem, window)
      }
      window.on('updateSlot', windowUpdateHandler)

      window.once('close', () => {
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

  if (options.startOnLoad || options.startOnLoad === undefined || options.startOnLoad === null) start() // Start the server by default when the plugin is loaded

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
