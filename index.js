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
    // On connection sends the initial state of the inventory. Also has to add each item's texture
    const items = bot.inventory.itemsRange(0, bot.inventory.inventoryEnd)
    for (const item in items) {
      items[item].texture = mcAssets.textureContent[items[item].name].texture
    }
    socket.emit('inventory', items)

    let updates = {}

    const debounceUpdate = _.debounce(() => {
      socket.emit('inventoryUpdate', updates)
      updates = {}
    }, debounceTime)

    function update (slot, oldItem, newItem, window) {
      if (oldItem) oldItem = Object.assign({}, oldItem)
      if (newItem) newItem = Object.assign({}, newItem)

      if (window.id !== bot.inventory.id) { // If the update is not from the inventory window, we need to set the right slot number
        if (slot >= window.inventoryStart && slot < window.inventoryEnd) {
          slot -= window.inventoryStart - 9
          if (newItem) newItem.slot = slot
        } else { // If the update is outside the inventory part we should just ignore it
          return
        }
      }

      // Add item texture
      if (newItem) newItem.texture = mcAssets.textureContent[newItem.name].texture

      updates[slot] = newItem
      debounceUpdate()
    }
    bot.inventory.on('updateSlot', (slot, oldItem, newItem) => update(slot, oldItem, newItem, bot.inventory))

    const windowOpenHandler = (window) => {
      if (window.id === bot.inventory.id) return // We don't want to emit updates from the inventory twice

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
