module.exports = function (bot) {
  const path = require('path')

  const app = require('express')()
  const http = require('http').createServer(app)

  const io = require('socket.io')(http)

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/index.html'))
  })

  io.on('connection', (socket) => {
    const interval = setInterval(() => {
      io.emit('inventory', bot.inventory.items())
    }, 500)

    socket.on('disconnect', () => {
      clearInterval(interval)
    })
  })

  http.listen(3000, () => {
    console.log('listening on *:3000')
  })
}
