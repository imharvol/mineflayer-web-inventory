module.exports = function (bot, port = 3000) {
  const path = require('path')
  const express = require('express')

  const app = express()
  const http = require('http').createServer(app)

  const io = require('socket.io')(http)

  app.use('/public', express.static(path.join(__dirname, 'public')))

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
  })

  io.on('connection', (socket) => {
    socket.emit('inventory', bot.inventory.items())

    function sendUpdate (slot, oldItem, newItem) {
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
