const DEFAULT_VERSION = '1.16'

module.exports = function (bot, options) {
  options = options || {}
  const webPath = options.path || '/'
  const express = options.express || require('express')
  const app = options.app || express()
  const http = options.http || require('http').createServer(app)
  const io = options.io || require('socket.io').listen(http)
  const port = options.port || 3000

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

  app.use('/public', express.static(path.join(__dirname, 'public')))

  app.get(webPath, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
  })

  io.on('connection', (socket) => {
    // Add item textures
    const items = bot.inventory.items()
    for (const item in items) {
      items[item].texture = mcAssets.textureContent[items[item].name].texture
    }
    socket.emit('inventory', items)

    let updates = {}

    const debounceUpdate = _.debounce(() => {
      socket.emit('inventoryUpdate', updates)
      updates = {}
    }, 100)

    function update (slot, oldItem, newItem) {
      // Add item texture
      if (newItem) newItem.texture = mcAssets.textureContent[newItem.name].texture

      updates[slot] = newItem
      debounceUpdate()
    }
    bot.inventory.on('windowUpdate', update)

    socket.on('disconnect', () => {
      debounceUpdate.cancel()
      bot.inventory.removeListener('windowUpdate', update)
    })
  })

  bot.on('end', () => {
    stop()
  })

  if (options.startOnLoad || options.startOnLoad === undefined || options.startOnLoad === null) start() // Start the server by default when the plugin is loaded

  function start (cb) {
    cb = cb || noop
    if (bot.webInventory.isRunning) return cb(new Error('mineflayer-web-inventory is already running'))

    http.listen(port, () => {
      bot.webInventory.isRunning = true
      console.log(`Inventory web server running on *:${port}`)
      cb()
    })
  }

  function stop (cb) {
    cb = cb || noop
    if (!bot.webInventory.isRunning) return cb(new Error('mineflayer-web-inventory is not running'))

    http.close(() => {
      bot.webInventory.isRunning = false
      console.log('Inventory web server closed')
      cb()
    })
  }
}

function noop () {}
