module.exports = function (bot, port=3000) {
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
    const interval = setInterval(() => {
      io.emit('inventory', bot.inventory.items())
    }, 500)

    socket.on('disconnect', () => {
      clearInterval(interval)
    })
  })

  http.listen(port, () => {
    console.log(`Inventory web server running on *:${port}`)
  })
}
