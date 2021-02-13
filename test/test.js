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

describe('mineflayer-web-inventory tests', function () {
  let bot, socket
  this.timeout(10 * 60 * 1000)

  const serverPort = Math.round(30000 + Math.random() * 20000)
  serverProperties['server-port'] = serverPort
  const inventoryViewerPort = serverPort + 1
  const jarFile = path.join(__dirname, 'server.jar')
  const serverDir = path.join(__dirname, 'server')

  const server = new wrap.WrapServer(jarFile, serverDir)
  server.on('line', function (line) {
    console.log('SERVER:', line)
  })

  before('Test Server Setup', function (done) {
    this.timeout(2 * 60 * 1000)

    // Download and start the server
    console.log('TEST:', `Starting Minecraft server on localhost:${serverPort}`)
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
        console.log('TEST:', `Starting Inventory Viewer on http://localhost:${inventoryViewerPort}`)
        inventoryViewer(bot, { port: inventoryViewerPort })

        bot.once('spawn', () => {
          server.writeServer('op test\n')
          setTimeout(done, 5 * 1000)
        })
      })
    })
  })

  beforeEach('Reset State', function (done) {
    bot.chat('/clear\n')
    setTimeout(done, 500)
  })

  it('\'inventory\' Event', function (done) {
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
    }, 500)
  })

  it('\'inventoryUpdate\' Event', function (done) {
    this.timeout(10 * 1000)

    bot.chat('/give test dirt 16\n')

    socket.once('inventoryUpdate', (updates) => {
      assert(updates[36])
      assert.strictEqual(updates[36].name, 'dirt')
      assert.strictEqual(updates[36].count, 16)
      done()
    })
  })

  // Check that the inventory is updated even when a chest is open (even though it should work with other windows)
  it('Chest Updates', function (done) {
    this.timeout(30 * 1000)

    const chestPos = bot.entity.position.floored().offset(0, 0, 1)
    bot.chat('/give test dirt 16\n')
    bot.chat(`/setblock ${chestPos.toArray().join(' ')} minecraft:chest\n`)

    bot.once(`blockUpdate:${chestPos.toString()}`, async (oldBlock, newBlock) => {
      const chest = await bot.openContainer(bot.blockAt(chestPos))

      await sleep(500) // We have to wait a bit so the server sends the inventoryUpdates that are sent when a chest is openned that and that we don't want

      bot.moveSlotItem(54, 0, noop)
      socket.once('inventoryUpdate', (updates) => {
        assert.strictEqual(updates[36], null)

        bot.moveSlotItem(0, 56, noop)
        socket.once('inventoryUpdate', (updates) => {
          assert(updates[38]) // It may look as if this should be 56, but note that the socket receives the position in the inventory, not in the inventory + chest
          assert.strictEqual(updates[38].name, 'dirt')
          assert.strictEqual(updates[38].count, 16)

          bot.chat('/give test pumpkin 32\n')
          socket.once('inventoryUpdate', (updates) => {
            assert(updates[36])
            assert.strictEqual(updates[36].name, 'pumpkin')
            assert.strictEqual(updates[36].count, 32)

            chest.close()
            done()
          })
        })
      })
    })
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

function noop () {}

function sleep (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
