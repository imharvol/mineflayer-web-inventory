/* eslint-env mocha */

const path = require('path')
const assert = require('assert')
const wrap = require('minecraft-wrap')
const mineflayer = require('mineflayer')
const socketioClient = require('socket.io-client')
const inventoryViewer = require('../')
const vec3 = require('vec3')

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

  const botPos = vec3(50.5, 4, 50.5)
  const container1Pos = botPos.floored().offset(0, 0, 1)
  const container2Pos = botPos.floored().offset(0, 0, 2)

  const serverPort = Math.round(30000 + Math.random() * 20000)
  serverProperties['server-port'] = serverPort
  const inventoryViewerPort = serverPort + 1
  const jarFile = path.join(__dirname, 'server.jar')
  const serverDir = path.join(__dirname, 'server')
  const mcData = require('minecraft-data')(minecraftVersion)

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

          setTimeout(done, 10 * 1000)
        })
      })
    })
  })

  beforeEach('Reset State', function (done) {
    this.timeout(15 * 1000)

    bot.chat(`/setblock ${container1Pos.toArray().join(' ')} minecraft:air\n`)
    bot.chat(`/setblock ${container2Pos.toArray().join(' ')} minecraft:air\n`)
    bot.chat('/kill @e[type=item]\n')
    bot.chat('/clear\n')
    bot.chat(`/tp ${botPos.toArray().join(' ')}\n`)

    // Connect to the socket
    socket = socketioClient(`http://localhost:${inventoryViewerPort}/`).connect()
    socket.on('connect', () => {
      setTimeout(done, 5000)
    })
  })

  it('\'inventory\' Event', function (done) {
    this.timeout(10 * 1000)

    bot.chat('/give test pumpkin 32\n')
    bot.chat('/give test melon 16\n')

    setTimeout(() => {
      const tmpSocket = socketioClient(`http://localhost:${inventoryViewerPort}/`).connect()
      tmpSocket.once('inventory', (inventory) => {
        assert.strictEqual(inventory[0].name, 'pumpkin')
        assert.strictEqual(inventory[0].count, 32)
        assert.strictEqual(inventory[1].name, 'melon')
        assert.strictEqual(inventory[1].count, 16)

        tmpSocket.disconnect()

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
  it('Chest Updates Using moveSlotItem', function (done) {
    this.timeout(30 * 1000)

    bot.chat('/give test dirt 16\n')
    bot.chat(`/setblock ${container1Pos.toArray().join(' ')} minecraft:chest\n`)

    setTimeout(async () => {
      assert.strictEqual(bot.inventory.slots[36].name, 'dirt')
      assert.strictEqual(bot.inventory.slots[36].count, 16)

      const chest = await bot.openContainer(bot.blockAt(container1Pos))

      await sleep(2000) // We have to wait a bit so the server sends the inventoryUpdates that are sent when a chest is openned that and that we don't want

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
    }, 2500)
  })

  it('Chest Updates Using deposit and withdraw', function (done) {
    this.timeout(30 * 1000)

    bot.chat('/give test dirt 16\n')
    bot.chat(`/setblock ${container1Pos.toArray().join(' ')} minecraft:chest\n`)

    setTimeout(async () => {
      assert.strictEqual(bot.inventory.slots[36].name, 'dirt')
      assert.strictEqual(bot.inventory.slots[36].count, 16)

      const chest = await bot.openContainer(bot.blockAt(container1Pos))

      await sleep(2000) // We have to wait a bit so the server sends the inventoryUpdates that are sent when a chest is openned that and that we don't want

      socket.once('inventoryUpdate', (updates) => {
        assert.strictEqual(updates[36], null)

        socket.once('inventoryUpdate', (updates) => {
          assert(updates[9])
          assert.strictEqual(updates[9].name, 'dirt')
          assert.strictEqual(updates[9].count, 16)

          done()
        })
        chest.withdraw(mcData.itemsByName.dirt.id, null, 16, noop)
      })
      chest.deposit(mcData.itemsByName.dirt.id, null, 16, noop)
    }, 2500)
  })

  it('Double Chest Updates Using deposit and withdraw', function (done) {
    this.timeout(30 * 1000)

    bot.chat('/give test dirt 16\n')
    bot.chat(`/setblock ${container1Pos.toArray().join(' ')} minecraft:chest\n`)
    bot.chat(`/setblock ${container2Pos.toArray().join(' ')} minecraft:chest\n`)

    setTimeout(async () => {
      assert.strictEqual(bot.inventory.slots[36].name, 'dirt')
      assert.strictEqual(bot.inventory.slots[36].count, 16)

      const chest = await bot.openContainer(bot.blockAt(container1Pos))

      await sleep(2000) // We have to wait a bit so the server sends the inventoryUpdates that are sent when a chest is openned that and that we don't want

      socket.once('inventoryUpdate', (updates) => {
        assert.strictEqual(updates[36], null)

        socket.once('inventoryUpdate', (updates) => {
          assert(updates[9])
          assert.strictEqual(updates[9].name, 'dirt')
          assert.strictEqual(updates[9].count, 16)

          done()
        })
        chest.withdraw(mcData.itemsByName.dirt.id, null, 16, noop)
      })
      chest.deposit(mcData.itemsByName.dirt.id, null, 16, noop)
    }, 2500)
  })

  /**
   * - Gives 16xcoal to the bot
   * - Gives 1xraw beef to the bot
   * - Places the furnace
   * - Opens the furnace
   * - Puts the coal in the furnace
   * - Puts the beef in the furnace and waits for it to be cooked
   * - Takes the output (1xcooked beef)
   * - Takes the fuel (15xcoal)
   *
   * All of this while verifiying that it's being updated correctly on the socket
   */
  it('Furnace Updates Using Furnace\'s functions', function (done) {
    this.timeout(30 * 1000)

    bot.chat('/give test coal 16\n')
    bot.chat('/give test beef 1\n')
    bot.chat(`/setblock ${container1Pos.toArray().join(' ')} minecraft:furnace\n`)

    setTimeout(async () => {
      assert.strictEqual(bot.inventory.slots[36].name, 'coal')
      assert.strictEqual(bot.inventory.slots[36].count, 16)
      assert.strictEqual(bot.inventory.slots[37].name, 'beef')
      assert.strictEqual(bot.inventory.slots[37].count, 1)

      const furnace = await bot.openFurnace(bot.blockAt(container1Pos))

      await sleep(2000) // We have to wait a bit so the server sends the inventoryUpdates that are sent when a chest is openned that and that we don't want

      socket.once('inventoryUpdate', (updates) => {
        assert.strictEqual(updates[36], null)

        socket.once('inventoryUpdate', (updates) => {
          assert.strictEqual(updates[37], null)

          function furnaceUpdateHandler () {
            if (furnace.outputItem()) {
              furnace.removeListener('update', furnaceUpdateHandler)

              socket.once('inventoryUpdate', (updates) => {
                assert.strictEqual(updates[9].name, 'cooked_beef')
                assert.strictEqual(updates[9].count, 1)

                socket.once('inventoryUpdate', (updates) => {
                  assert.strictEqual(updates[10].name, 'coal')
                  assert.strictEqual(updates[10].count, 15)

                  done()
                })
                furnace.takeFuel(noop)
              })
              furnace.takeOutput(noop)
            }
          }
          furnace.on('update', furnaceUpdateHandler)
        })
        furnace.putInput(mcData.itemsByName.beef.id, null, 1, noop)
      })
      furnace.putFuel(mcData.itemsByName.coal.id, null, 16, noop)
    }, 2500)
  })

  afterEach('Reset State', function (done) {
    this.timeout(15 * 1000)

    if (socket && socket.connected) {
      socket.on('disconnect', () => done())
      socket.disconnect()
    } else {
      done()
    }
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
