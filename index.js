const DEFAULT_VERSION = '1.15.2'

module.exports = function (bot, port = 3000) {
  const path = require('path')
  const express = require('express')

  const app = express()
  const http = require('http').createServer(app)

  const io = require('socket.io')(http)

  // Try to load mcAssets
  let mcAssets = require('minecraft-assets')(bot.version)
  if (!mcAssets) {
    mcAssets = require('minecraft-assets')(DEFAULT_VERSION)
    if (mcAssets) {
      console.log(`(web-inventory) WARNING: Please, specify a bot.version. Using ${DEFAULT_VERSION} for minecraft-assets`)
    } else {
      console.log('(web-inventory) ERROR: Couldn\'t load minecraft-assets')
      return
    }
  }

  app.use('/public', express.static(path.join(__dirname, 'public')))

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
  })

  io.on('connection', (socket) => {
    // Add item textures
    const items = bot.inventory.items()
    for (const item in items) {
      items[item].texture = mcAssets.textureContent[items[item].name].texture
    }
    socket.emit('inventory', items)

    function sendUpdate (slot, oldItem, newItem) {
      // Add item texture
      if (newItem) newItem.texture = mcAssets.textureContent[newItem.name].texture

      socket.emit('inventoryUpdate', slot, newItem)
    }
    bot.inventory.on('windowUpdate', sendUpdate)

    socket.on('disconnect', () => {
      bot.inventory.removeListener('windowUpdate', sendUpdate)
    })
  })

  http.listen(port, () => {
    console.log(`Inventory web server running on *:${port}`)
  })
}
