/* eslint-env mocha */

const path = require('path')
const assert = require('assert')
const wrap = require('minecraft-wrap')
const mineflayer = require('mineflayer')
const socketioClient = require('socket.io-client')
const inventoryViewer = require('../')

const serverProperties = {
  'level-type': 'FLAT',
  'spawn-npcs': 'false',
  'spawn-animals': 'false',
  'online-mode': 'false',
  gamemode: 'creative',
  'spawn-monsters': 'false',
  'generate-structures': 'false'
}

const minecraftVersion = '1.16'

describe('mineflayer-web-inventory tests', () => {
  let bot, socket
  const serverPort = Math.round(30000 + Math.random() * 20000)
  serverProperties['server-port'] = serverPort
  const inventoryViewerPort = serverPort + 1
  const jarFile = path.join(__dirname, 'server.jar')
  const serverDir = path.join(__dirname, 'server')

  console.log('TEST:', `Starting Minecraft server on localhost:${serverPort}`)
  console.log('TEST:', `Starting Inventory Viewer on http://localhost:${inventoryViewerPort}`)

  const server = new wrap.WrapServer(jarFile, serverDir)
  server.on('line', function (line) {
    console.log('SERVER:', line)
  })

  before('Test Server Setup', function (done) {
    this.timeout(2 * 60 * 1000)

    // Download and start the server
    wrap.download(minecraftVersion, jarFile, (err) => {
      if (err) throw err
      server.startServer(serverProperties, (err) => {
        if (err) throw err

        // Start the client using mineflayer
        bot = mineflayer.createBot({
          host: 'localhost',
          port: serverPort,
          username: 'test',
          version: minecraftVersion
        })

        // Start the inventory viewer
        inventoryViewer(bot, { port: inventoryViewerPort })

        bot.once('spawn', () => {
          server.writeServer('op test\n')
          setTimeout(done, 5 * 1000)
        })
      })
    })
  })

  it('\'inventory\' event', function (done) {
    this.timeout(10 * 1000)

    bot.chat('/give test pumpkin 32\n')
    bot.chat('/give test melon 16\n')

    setTimeout(() => {
      socket = socketioClient(`http://localhost:${inventoryViewerPort}/`).connect()
      socket.once('inventory', (inventory) => {
        assert.strictEqual(inventory[0].name, 'pumpkin')
        assert.strictEqual(inventory[0].count, 32)
        assert.strictEqual(inventory[1].name, 'melon')
        assert.strictEqual(inventory[1].count, 16)
        done()
      })
    }, 250)
  })

  it('\'inventoryUpdate\' event', function (done) {
    this.timeout(10 * 1000)

    socket.once('inventoryUpdate', (updates) => {
      console.log(updates)
      assert(updates[38])
      assert.strictEqual(updates[38].name, 'dirt')
      assert.strictEqual(updates[38].count, 16)
      done()
    })
    bot.chat('/give test dirt 16\n')
  })

  after('Test Server Termination', function (done) {
    this.timeout(3 * 60 * 1000)

    console.log('TEST:', 'Stopping socket ...')
    socket.close()

    console.log('TEST:', 'Stopping client ...')
    bot.quit()

    console.log('TEST:', 'Stopping server ...')
    server.stopServer((err) => {
      if (err) throw err

      console.log('TEST:', 'Deleting server data ...')
      server.deleteServerData((err) => {
        if (err) throw err

        done()
      })
    })
  })
})
