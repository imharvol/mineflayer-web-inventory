const DEFAULT_VERSION = '1.15.2'

module.exports = function (bot, options) {
  options = options || {}
  let path = options.path || require('path')
  let express = options.express || require('express')
  let app = options.app || express()
  let http = options.http || require('http').createServer(app)
  let io = options.io || require('socket.io').listen(http)
  let port = options.port || 3000

  const _ = require('lodash')

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

  app.get(path, (req, res) => {
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

  http.listen(port, () => {
    console.log(`Inventory web server running on *:${port}`)
  })
}
