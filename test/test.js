/* eslint-env mocha */

const path = require('path')
const assert = require('assert')
const wrap = require('minecraft-wrap')
const mineflayer = require('mineflayer')
const socketioClient = require('socket.io-client')
const inventoryViewer = require('../')
const vec3 = require('vec3')
const open = require('open')
const { setFailStreak } = require('../utils')

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

describe(`mineflayer-web-inventory tests ${minecraftVersion}`, function () {
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
        inventoryViewer(bot, { port: inventoryViewerPort, debounceTime: 0 })
        if (process.argv[2] === '--browser') open(`http://localhost:${inventoryViewerPort}`)

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

  it('\'window\' Event', function (done) {
    this.timeout(10 * 1000)

    bot.chat('/give test pumpkin 32\n') // Slot 36
    bot.chat('/give test melon 16\n') // Slot 37
    bot.chat('/give test iron_helmet 1\n') // Slot 38, equipped to slot 5

    setTimeout(() => {
      bot.equip(mcData.itemsByName.iron_helmet.id, 'head', () => {
        setTimeout(() => {
          const tmpSocket = socketioClient(`http://localhost:${inventoryViewerPort}/`).connect()
          tmpSocket.once('window', (window) => {
            assert.strictEqual(window.id, 0)
            assert.strictEqual(window.type, 'inventory')

            assert.strictEqual(window.slots[5]?.name, 'iron_helmet')
            assert.strictEqual(window.slots[5]?.count, 1)
            assert(window.slots[5]?.texture)
            assert.strictEqual(window.slots[36]?.name, 'pumpkin')
            assert.strictEqual(window.slots[36]?.count, 32)
            assert(window.slots[36]?.texture)
            assert.strictEqual(window.slots[37]?.name, 'melon')
            assert.strictEqual(window.slots[37]?.count, 16)
            assert(window.slots[37]?.texture)

            tmpSocket.disconnect()

            done()
          })
        }, 1000)
      })
    }, 1000)
  })

  it('\'windowUpdate\' Event', function (done) {
    this.timeout(10 * 1000)

    bot.chat('/give test dirt 16\n') // Slot 36

    socket.once('windowUpdate', (windowUpdate) => {
      assert.strictEqual(windowUpdate.id, 0)
      assert.strictEqual(windowUpdate.type, 'inventory')

      assert.strictEqual(windowUpdate.slots[36]?.name, 'dirt')
      assert.strictEqual(windowUpdate.slots[36]?.count, 16)
      assert(windowUpdate.slots[36]?.texture)

      done()
    })
  })

  // Check that the inventory is updated even when a chest is open (even though it should work with other windows)
  it('Chest Updates Using moveSlotItem', function (done) {
    this.timeout(30 * 1000)

    bot.chat('/give test dirt 16\n') // Slot 54
    bot.chat(`/setblock ${container1Pos.toArray().join(' ')} minecraft:chest\n`)

    setTimeout(async () => {
      assert.strictEqual(bot.inventory.slots[36]?.name, 'dirt')
      assert.strictEqual(bot.inventory.slots[36]?.count, 16)

      const chest = await bot.openContainer(bot.blockAt(container1Pos))

      await sleep(2000) // We have to wait a bit so the server sends the inventoryUpdates that are sent when a chest is opened that and that we don't want

      socket.once('windowUpdate', (windowUpdate) => {
        assert.strictEqual(windowUpdate.id, bot.currentWindow?.id)
        assert.strictEqual(windowUpdate.type, 'chest')

        assert.strictEqual(windowUpdate.slots[0]?.name, 'dirt')
        assert.strictEqual(windowUpdate.slots[0]?.count, 16)
        assert(windowUpdate.slots[0]?.texture)
        assert.strictEqual(windowUpdate.slots[54], null)

        socket.once('windowUpdate', (windowUpdate) => {
          assert.strictEqual(windowUpdate.id, bot.currentWindow?.id)
          assert.strictEqual(windowUpdate.type, 'chest')

          assert.strictEqual(windowUpdate.slots[56]?.name, 'dirt')
          assert.strictEqual(windowUpdate.slots[56]?.count, 16)
          assert(windowUpdate.slots[56]?.texture)
          assert.strictEqual(windowUpdate.slots[0], null)

          socket.once('windowUpdate', (windowUpdate) => {
            assert.strictEqual(windowUpdate.id, bot.currentWindow?.id)
            assert.strictEqual(windowUpdate.type, 'chest')

            assert.strictEqual(windowUpdate.slots[54]?.name, 'pumpkin')
            assert.strictEqual(windowUpdate.slots[54]?.count, 32)
            assert(windowUpdate.slots[54]?.texture)

            chest.close()

            done()
          })
          bot.chat('/give test pumpkin 32\n') // Slot 54
        })
        bot.moveSlotItem(0, 56, noop)
      })
      bot.moveSlotItem(54, 0, noop)
    }, 2500)
  })

  it('Chest Updates Using deposit and withdraw', function (done) {
    this.timeout(30 * 1000)

    bot.chat('/give test dirt 16\n') // Slot 54
    bot.chat(`/setblock ${container1Pos.toArray().join(' ')} minecraft:chest\n`)

    setTimeout(async () => {
      assert.strictEqual(bot.inventory.slots[36]?.name, 'dirt')
      assert.strictEqual(bot.inventory.slots[36]?.count, 16)

      const chest = await bot.openContainer(bot.blockAt(container1Pos))

      await sleep(2000) // We have to wait a bit so the server sends the inventoryUpdates that are sent when a chest is opened that and that we don't want

      socket.once('windowUpdate', (windowUpdate) => {
        assert.strictEqual(windowUpdate.id, bot.currentWindow?.id)
        assert.strictEqual(windowUpdate.type, 'chest')

        assert.strictEqual(windowUpdate.slots[0]?.name, 'dirt')
        assert.strictEqual(windowUpdate.slots[0]?.count, 16)
        assert(windowUpdate.slots[0]?.texture)
        assert.strictEqual(windowUpdate.slots[54], null)

        socket.once('windowUpdate', (windowUpdate) => {
          assert.strictEqual(windowUpdate.id, bot.currentWindow?.id)
          assert.strictEqual(windowUpdate.type, 'chest')

          assert.strictEqual(windowUpdate.slots[0], null)
          assert.strictEqual(windowUpdate.slots[27]?.name, 'dirt')
          assert.strictEqual(windowUpdate.slots[27]?.count, 16)
          assert(windowUpdate.slots[27]?.texture)

          chest.close()

          done()
        })
        chest.withdraw(mcData.itemsByName.dirt.id, null, 16, noop) // Moves from slot 0 to slot 27
      })
      chest.deposit(mcData.itemsByName.dirt.id, null, 16, noop) // Moves from slot 54 to slot 0
    }, 2500)
  })

  it('Double Chest Updates Using deposit and withdraw', function (done) {
    this.timeout(30 * 1000)

    bot.chat('/give test dirt 16\n')
    if (['1.8', '1.9', '1.10', '1.11', '1.12'].includes(bot.majorVersion)) {
      bot.chat(`/setblock ${container1Pos.toArray().join(' ')} minecraft:chest\n`)
      bot.chat(`/setblock ${container2Pos.toArray().join(' ')} minecraft:chest\n`)
    } else {
      bot.chat(`/setblock ${container1Pos.toArray().join(' ')} minecraft:chest[facing=west,type=right]\n`)
      bot.chat(`/setblock ${container2Pos.toArray().join(' ')} minecraft:chest[facing=west,type=left]\n`)
    }

    setTimeout(async () => {
      assert.strictEqual(bot.inventory.slots[36]?.name, 'dirt')
      assert.strictEqual(bot.inventory.slots[36]?.count, 16)

      const chest = await bot.openContainer(bot.blockAt(container1Pos))

      await sleep(2000) // We have to wait a bit so the server sends the inventoryUpdates that are sent when a chest is opened that and that we don't want

      socket.once('windowUpdate', (windowUpdate) => {
        assert.strictEqual(windowUpdate.id, bot.currentWindow?.id)
        assert.strictEqual(windowUpdate.type, 'large-chest')

        assert.strictEqual(windowUpdate.slots[0]?.name, 'dirt')
        assert.strictEqual(windowUpdate.slots[0]?.count, 16)
        assert(windowUpdate.slots[0]?.texture)
        assert.strictEqual(windowUpdate.slots[81], null)

        socket.once('windowUpdate', (windowUpdate) => {
          assert.strictEqual(windowUpdate.id, bot.currentWindow?.id)
          assert.strictEqual(windowUpdate.type, 'large-chest')

          assert.strictEqual(windowUpdate.slots[0], null)
          assert.strictEqual(windowUpdate.slots[54]?.name, 'dirt')
          assert.strictEqual(windowUpdate.slots[54]?.count, 16)
          assert(windowUpdate.slots[54]?.texture)

          chest.close()

          done()
        })
        chest.withdraw(mcData.itemsByName.dirt.id, null, 16, noop) // Moves from slot 0 to slot 54
      })
      chest.deposit(mcData.itemsByName.dirt.id, null, 16, noop) // Moves from slot 81 to slot 0
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
      assert.strictEqual(bot.inventory.slots[36]?.name, 'coal')
      assert.strictEqual(bot.inventory.slots[36]?.count, 16)
      assert.strictEqual(bot.inventory.slots[37]?.name, 'beef')
      assert.strictEqual(bot.inventory.slots[37]?.count, 1)

      const furnace = await bot.openFurnace(bot.blockAt(container1Pos))

      await sleep(2000) // We have to wait a bit so the server sends the inventoryUpdates that are sent when a chest is opened that and that we don't want

      socket.once('windowUpdate', (windowUpdate) => {
        assert.strictEqual(windowUpdate.id, bot.currentWindow?.id)
        assert.strictEqual(windowUpdate.type, 'furnace')

        assert.strictEqual(windowUpdate.slots[30], null)

        socket.once('windowUpdate', (windowUpdate) => {
          assert.strictEqual(windowUpdate.id, bot.currentWindow?.id)
          assert.strictEqual(windowUpdate.type, 'furnace')

          assert.strictEqual(windowUpdate.slots[31], null)

          function furnaceUpdateHandler () {
            if (furnace.outputItem()) {
              furnace.removeListener('update', furnaceUpdateHandler)

              socket.once('windowUpdate', (windowUpdate) => {
                assert.strictEqual(windowUpdate.id, bot.currentWindow?.id)
                assert.strictEqual(windowUpdate.type, 'furnace')

                assert.strictEqual(windowUpdate.slots[3]?.name, 'cooked_beef')
                assert.strictEqual(windowUpdate.slots[3]?.count, 1)
                assert(windowUpdate.slots[3]?.texture)

                socket.once('windowUpdate', (windowUpdate) => {
                  assert.strictEqual(windowUpdate.id, bot.currentWindow?.id)
                  assert.strictEqual(windowUpdate.type, 'furnace')

                  assert.strictEqual(windowUpdate.slots[4]?.name, 'coal')
                  assert.strictEqual(windowUpdate.slots[4]?.count, 15)
                  assert(windowUpdate.slots[4]?.texture)

                  furnace.close()

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

  // Opens and updates an unsupported window. The bot should receive inventory updates instead of updates from an unknown window
  it('Unsupported window', function (done) {
    this.timeout(30 * 1000)

    bot.chat('/give test dirt 16\n') // Slot 36
    bot.chat(`/setblock ${container1Pos.toArray().join(' ')} minecraft:chest\n`)

    setTimeout(async () => {
      assert.strictEqual(bot.inventory.slots[36]?.name, 'dirt')
      assert.strictEqual(bot.inventory.slots[36]?.count, 16)

      // We want getWindowName to return null once to simulate an unknown window
      setFailStreak([true, false, true])

      socket.once('window', (window) => {
        assert.strictEqual(window.id, 0)
        assert.strictEqual(window.type, 'inventory')

        assert.strictEqual(window.slots[36]?.name, 'dirt')
        assert.strictEqual(window.slots[36]?.count, 16)
        assert(window.slots[36]?.texture)

        socket.on('windowUpdate', (windowUpdate) => {
          assert.strictEqual(windowUpdate.id, 0)
          assert.strictEqual(windowUpdate.type, 'inventory')

          assert.strictEqual(windowUpdate.slots[36]?.name, 'dirt')
          assert.strictEqual(windowUpdate.slots[36]?.count, 16)
          assert(windowUpdate.slots[36]?.texture)

          chest.close()

          done()
        })
      })
      const chest = await bot.openContainer(bot.blockAt(container1Pos))
    }, 2500)
  })

  // TODO: Check also that the item slot is set correctly (not only the position in the array)

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
