/* eslint-env mocha */

const path = require('path')
const assert = require('assert')
const wrap = require('minecraft-wrap')
const mineflayer = require('mineflayer')
const socketioClient = require('socket.io-client')
const inventoryViewer = require('../')
const vec3 = require('vec3')
const open = require('open')
// const { setFailStreak } = require('../utils')
const { receiveWindow, updateWindow } = require('../client/src/updateWindow')

const serverProperties = {
  'level-type': 'FLAT',
  'spawn-npcs': 'false',
  'spawn-animals': 'false',
  'online-mode': 'false',
  gamemode: 'creative',
  'spawn-monsters': 'false',
  'generate-structures': 'false'
}

const minecraftVersion = process.env.TEST_MC_VERSION ?? '1.20.4'

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Asserts that a window object matches an id and a type. If an expected value parameter is false, it will not try to sassert
 * @param {Object} actualWindow Window objet with properties `id` and `type`
 * @param {Boolean|Number} expectedWindowId
 * @param {Boolean|String} expectedWindowType
 */
const assertWindow = (actualWindow, expectedWindowId, expectedWindowType) => {
  if (expectedWindowId !== false) assert.strictEqual(actualWindow?.id, expectedWindowId)
  if (expectedWindowType !== false) assert.strictEqual(actualWindow?.type, expectedWindowType)
}

/**
 * Asserts that a slot object matches a name and a count. If an expected value parameter is false, it will not try to assert
 * @param {Object} actualSlot
 * @param {Boolean|String} expectedSlotName
 * @param {Boolean|Number} expectedSlotCount
 * @param {Boolean} assertTexture
 */
const assertSlot = (actualSlot, expectedSlotName, expectedSlotCount, assertTexture) => {
  if (expectedSlotName !== false) assert.strictEqual(actualSlot?.name, expectedSlotName)
  if (expectedSlotCount !== false) assert.strictEqual(actualSlot?.count, expectedSlotCount)
  if (assertTexture !== false) assert(actualSlot?.texture) // TODO: Check that the texture is the right one
}

/**
 * Asserts that the slot at `slotNumber` matches a name `expectedSlotName` and a count `expectedSlotCount` in both windows
 * @param {Object} mineflayerWindow mineflayer's window representation (will not assert that it has a  texture)
 * @param {Object} webWindow mineflayer-web-inventory's window representation (will assert that it has a  texture)
 * @param {Number} slotNumber
 * @param {Boolean|String} expectedSlotName
 * @param {Boolean|Number} expectedSlotCount
 */
const assertSlotMatch = (mineflayerWindow, webWindow, slotNumber, expectedSlotName, expectedSlotCount) => {
  assertSlot(mineflayerWindow.slots[slotNumber], expectedSlotName, expectedSlotCount, false)
  assertSlot(webWindow.slots[slotNumber], expectedSlotName, expectedSlotCount, true)
}

/**
 * Asserts that the slot at `slotNumber` is null in both windows
 * @param {Object} mineflayerWindow
 * @param {Object} webWindow
 * @param {Number} slotNumber
 */
const assertNullSlotMatch = (mineflayerWindow, webWindow, slotNumber) => {
  assert.strictEqual(mineflayerWindow.slots[slotNumber], null)
  assert.strictEqual(webWindow.slots[slotNumber], null)
}

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

  // Shared variables
  let window = null

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
        inventoryViewer(bot, { port: inventoryViewerPort, windowUpdateDebounceTime: 100 })
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

    window = null

    // Setup a clean enviroment
    bot.chat(`/setblock ${botPos.floored().offset(0, -1, 0).toArray().join(' ')} minecraft:dirt`)
    bot.chat(`/setblock ${container1Pos.toArray().join(' ')} minecraft:air`)
    bot.chat(`/setblock ${container2Pos.toArray().join(' ')} minecraft:air`)
    bot.chat('/kill @e[type=item]')
    bot.chat('/clear')
    bot.chat(`/tp ${botPos.toArray().join(' ')}`)

    // Connect to the socket
    socket = socketioClient(`http://localhost:${inventoryViewerPort}/`).connect()
    socket.on('connect', () => {
      setTimeout(done, 5000)
    })

    // Update the window object as the socket sends updates
    const socketWindowHandler = (_window) => {
      window = receiveWindow(window, _window)
    }
    const socketWindowUpdateHanlder = (_windowUpdate) => {
      window = updateWindow(window, _windowUpdate)
    }
    socket.on('window', socketWindowHandler)
    socket.on('windowUpdate', socketWindowUpdateHanlder)

    // Free memory once the socket disconnects
    socket.on('disconnect', () => {
      socket.removeListener('window', socketWindowHandler)
      socket.removeListener('windowUpdate', socketWindowUpdateHanlder)
    })
  })

  afterEach('Reset State', function (done) {
    this.timeout(15 * 1000)

    window = null

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

  it('\'window\' Event', async function () {
    this.timeout(10 * 1000)

    bot.chat('/give test pumpkin 32') // Slot 36
    bot.chat('/give test melon 16') // Slot 37
    bot.chat('/give test iron_helmet 1') // Slot 38, equipped to slot 5

    await sleep(1000)

    await bot.equip(mcData.itemsByName.iron_helmet.id, 'head')

    await sleep(1000)

    assertWindow(window, 0, 'inventory')
    assertSlotMatch(bot.inventory, window, 5, 'iron_helmet', 1)
    assertSlotMatch(bot.inventory, window, 36, 'pumpkin', 32)
    assertSlotMatch(bot.inventory, window, 37, 'melon', 16)
  })

  it('\'windowUpdate\' Event', async function () {
    this.timeout(10 * 1000)

    bot.chat('/give test dirt 16') // Slot 36

    await sleep(1000)

    assertWindow(window, 0, 'inventory')
    assertSlotMatch(bot.inventory, window, 36, 'dirt', 16)
  })

  // Check that the inventory is updated even when a chest is open (even though it should work with other windows)
  it('Chest updates using moveSlotItem', async function () {
    this.timeout(30 * 1000)

    bot.chat(`/setblock ${container1Pos.toArray().join(' ')} minecraft:chest`)

    // Correct slot before opening the chest
    bot.chat('/give test dirt 16')
    await sleep(2500)
    assertWindow(window, 0, 'inventory')
    assertSlotMatch(bot.inventory, window, 36, 'dirt', 16)

    // Correct slot after opening the chest
    const chest = await bot.openContainer(bot.blockAt(container1Pos))
    await sleep(2000)
    assertWindow(window, bot.currentWindow?.id, 'chest')
    assertSlotMatch(bot.currentWindow, window, 54, 'dirt', 16)
    assertNullSlotMatch(bot.currentWindow, window, 36)

    // Slot moves from inventory to chest
    bot.moveSlotItem(54, 0)
    await sleep(2000)
    assertWindow(window, bot.currentWindow?.id, 'chest')
    assertSlotMatch(bot.currentWindow, window, 0, 'dirt', 16)
    assertNullSlotMatch(bot.currentWindow, window, 54)

    // Slot moves from inventory to chest
    bot.moveSlotItem(0, 56)
    await sleep(2000)
    assertWindow(window, bot.currentWindow?.id, 'chest')
    assertSlotMatch(bot.currentWindow, window, 56, 'dirt', 16)
    assertNullSlotMatch(bot.currentWindow, window, 0)

    // Give pumpkins while the chest is open
    bot.chat('/give test pumpkin 32')
    await sleep(2000)
    assertWindow(window, bot.currentWindow?.id, 'chest')
    assertSlot(window.slots[54], 'pumpkin', 32)
    assertSlot(window.slots[56], 'dirt', 16)

    assertSlotMatch(bot.currentWindow, window, 54, 'pumpkin', 32)
    assertSlotMatch(bot.currentWindow, window, 56, 'dirt', 16)

    chest.close()
    await sleep(2000)

    // Check that after closing the chest, the window changes to an inventory
    // but stays updated with the pumpkings that were received while the chest was open
    assertWindow(window, 0, 'inventory')
    assertSlotMatch(bot.inventory, window, 36, 'pumpkin', 32)
    assertSlotMatch(bot.inventory, window, 38, 'dirt', 16)
  })

  it('Chest updates using deposit and withdraw', async function () {
    this.timeout(30 * 1000)

    bot.chat(`/setblock ${container1Pos.toArray().join(' ')} minecraft:chest`)

    // Correct slot before opening the chest
    bot.chat('/give test dirt 16')
    await sleep(2500)
    assertWindow(window, 0, 'inventory')
    assertSlotMatch(bot.inventory, window, 36, 'dirt', 16)

    // Correct slot after opening the chest
    const chest = await bot.openContainer(bot.blockAt(container1Pos))
    await sleep(2000)
    assertWindow(window, bot.currentWindow?.id, 'chest')
    assertSlotMatch(bot.currentWindow, window, 54, 'dirt', 16)
    assertNullSlotMatch(bot.currentWindow, window, 36)

    // Slot moves from inventory to chest
    chest.deposit(mcData.itemsByName.dirt.id, null, 16) // Moves from slot 54 to slot 0
    await sleep(2000)
    assertWindow(window, bot.currentWindow?.id, 'chest')
    assertSlotMatch(bot.currentWindow, window, 0, 'dirt', 16)
    assertNullSlotMatch(bot.currentWindow, window, 54)

    // Slot moves from chest to inventory
    chest.withdraw(mcData.itemsByName.dirt.id, null, 16) // Moves from slot 0 to slot 27
    await sleep(2000)
    assertWindow(window, bot.currentWindow?.id, 'chest')
    assertSlotMatch(bot.currentWindow, window, 27, 'dirt', 16)
    assertNullSlotMatch(bot.currentWindow, window, 0)

    // Give pumpkins while the chest is open
    bot.chat('/give test pumpkin 32')
    await sleep(2000)
    assertWindow(window, bot.currentWindow?.id, 'chest')
    assertSlotMatch(bot.currentWindow, window, 54, 'pumpkin', 32)
    assertSlotMatch(bot.currentWindow, window, 27, 'dirt', 16)

    chest.close()
  })

  it('Double Chest Updates Using deposit and withdraw', async function () {
    this.timeout(30 * 1000)

    if (['1.8', '1.9', '1.10', '1.11', '1.12'].includes(bot.majorVersion)) {
      bot.chat(`/setblock ${container1Pos.toArray().join(' ')} minecraft:chest`)
      bot.chat(`/setblock ${container2Pos.toArray().join(' ')} minecraft:chest`)
    } else {
      bot.chat(`/setblock ${container1Pos.toArray().join(' ')} minecraft:chest[facing=west,type=right]`)
      bot.chat(`/setblock ${container2Pos.toArray().join(' ')} minecraft:chest[facing=west,type=left]`)
    }

    // Correct slot before opening the double chest
    bot.chat('/give test dirt 16')
    await sleep(2500)
    assertWindow(window, 0, 'inventory')
    assertSlotMatch(bot.inventory, window, 36, 'dirt', 16)

    // Correct slot after opening the double chest
    const chest = await bot.openContainer(bot.blockAt(container1Pos))
    await sleep(2000)
    assertWindow(window, bot.currentWindow?.id, 'large-chest')
    assertSlotMatch(bot.currentWindow, window, 81, 'dirt', 16)
    assertNullSlotMatch(bot.currentWindow, window, 36)

    // Slot moves from inventory to double chest
    chest.deposit(mcData.itemsByName.dirt.id, null, 16) // Moves from slot 81 to slot 0
    await sleep(2000)
    assertWindow(window, bot.currentWindow?.id, 'large-chest')
    assertSlotMatch(bot.currentWindow, window, 0, 'dirt', 16)
    assertNullSlotMatch(bot.currentWindow, window, 81)

    // Slot moves from double chest to inventory
    chest.withdraw(mcData.itemsByName.dirt.id, null, 16) // Moves from slot 0 to slot 54
    await sleep(2000)
    assertWindow(window, bot.currentWindow?.id, 'large-chest')
    assertSlotMatch(bot.currentWindow, window, 54, 'dirt', 16)
    assertNullSlotMatch(bot.currentWindow, window, 0)

    // Give pumpkins while the double chest is open
    bot.chat('/give test pumpkin 32')
    await sleep(2000)
    assertWindow(window, bot.currentWindow?.id, 'large-chest')
    assertSlotMatch(bot.currentWindow, window, 81, 'pumpkin', 32)
    assertSlotMatch(bot.currentWindow, window, 54, 'dirt', 16)

    chest.close()
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
  it('Furnace Updates Using Furnace\'s functions', async function () {
    this.timeout(30 * 1000)

    bot.chat(`/setblock ${container1Pos.toArray().join(' ')} minecraft:furnace`)

    // Correct slots before opening the furnace
    bot.chat('/give test coal 16')
    bot.chat('/give test beef 1')
    await sleep(2500)
    assertWindow(window, 0, 'inventory')
    assertSlotMatch(bot.inventory, window, 36, 'coal', 16)
    assertSlotMatch(bot.inventory, window, 37, 'beef', 1)

    // Correct slots after opening the furnace
    const furnace = await bot.openFurnace(bot.blockAt(container1Pos))
    await sleep(2000)
    assertWindow(window, bot.currentWindow?.id, 'furnace')
    assertSlotMatch(bot.currentWindow, window, 30, 'coal', 16)
    assertSlotMatch(bot.currentWindow, window, 31, 'beef', 1)
    assertNullSlotMatch(bot.currentWindow, window, 36)
    assertNullSlotMatch(bot.currentWindow, window, 37)

    // Put fuel in the furnace
    furnace.putFuel(mcData.itemsByName.coal.id, null, 16)
    await sleep(2000)
    assertWindow(window, bot.currentWindow?.id, 'furnace')
    assertSlotMatch(bot.currentWindow, window, 1, 'coal', 16)
    assertNullSlotMatch(bot.currentWindow, window, 30)

    // Put beef in the furnace
    furnace.putInput(mcData.itemsByName.beef.id, null, 1)
    await sleep(2000)
    assertWindow(window, bot.currentWindow?.id, 'furnace')
    assertSlotMatch(bot.currentWindow, window, 0, 'beef', 1)
    assertNullSlotMatch(bot.currentWindow, window, 31)

    // Wait for the furnace to cook the beef
    await new Promise(resolve => {
      function furnaceUpdateHandler () {
        if (furnace.outputItem()) {
          furnace.removeListener('update', furnaceUpdateHandler)
          resolve()
        }
      }
      furnace.on('update', furnaceUpdateHandler)
    })

    // Check that the furnace's output is reflected
    await sleep(2000)
    assertWindow(window, bot.currentWindow?.id, 'furnace')
    assertSlotMatch(bot.currentWindow, window, 2, 'cooked_beef', 1)
    assertSlotMatch(bot.currentWindow, window, 1, 'coal', 15)
    assertNullSlotMatch(bot.currentWindow, window, 0)

    // Take the output
    furnace.takeOutput()
    await sleep(2000)
    assertWindow(window, bot.currentWindow?.id, 'furnace')
    assertSlotMatch(bot.currentWindow, window, 3, 'cooked_beef', 1)
    assertNullSlotMatch(bot.currentWindow, window, 2)

    // Take the fuel
    furnace.takeFuel()
    await sleep(2000)
    assertWindow(window, bot.currentWindow?.id, 'furnace')
    assertSlotMatch(bot.currentWindow, window, 4, 'coal', 15)
    assertNullSlotMatch(bot.currentWindow, window, 1)

    furnace.close()
  })

  // Because versions 1.12 and lower had only one wool item id for all colors
  // and had the color coded into the item's metadata, it's best to run this test
  it('Wool textures', async function () {
    this.timeout(30 * 1000)

    if (mcData.version['<=']('1.12.2')) {
      bot.chat('/give test wool 3 5') // 3 x lime wool
    } else {
      bot.chat('/give test lime_wool 3') // 3 x lime wool
    }

    await sleep(2000)
    assertWindow(window, 0, 'inventory')

    // Check that the item's name is correct
    if (mcData.version['<=']('1.12.2')) {
      assertSlotMatch(bot.inventory, window, 36, 'wool', 3)
    } else {
      assertSlotMatch(bot.inventory, window, 36, 'lime_wool', 3)
    }

    // Check that the item's texture is correct (apparently wool's texture changed from 1.11 to 1.12)
    if (mcData.version['<=']('1.11.2')) {
      assert.strictEqual(window.slots[36].texture, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABsklEQVR42j2T60oDQQyF54WsvWy72213q3Vt6y8LPpciKIqiKKJQFEVBEPGG9cHifGlPf4SZzGROzkkyoXedWHHXtvyiacVVy7aeMqvee8Z5/zax4Wtu1VvP0uO65Zctq166buyz04aFzefMg6bzyvb+xjb6KPzB4L7jBiiBgOEn+2uWnTU86fAhtcCDna/CLzceU5v8DtwnC2eAuR9XjHuSsSexMwAN2gIqZx2Xgo8UzthjioctfgAFKgRyCRCG5vZBbQEe2SChe95c3VMDYgJ6ukfrVt4kq4w8VHHls4dJelJ3MGoD04Ce3fnItj/7jgx1DFZkpkbcwxQAqGNek3gfQMbUBRVHmslERtXIJUcbf5eLGqi6ao2CoA5FUQcE+rDDZ26oSVAAwdBND2teHM4ExCrqtJqE7GEdyAgdMUGv+i6qAPtMRM2cwYIu0LXARlkwGMHG2xVBqIE6wj0d867NFgyDdIo62Zk29NE+/Q3/A0vqGI+pSRBVHmm61CLvewSWbi9wbC8+e68BDyc/A9ejkZVWMuuD+fAspxIwZx7lBX4aGvVQEyYpZJR+zQXx+oT/Az0n0wHFqucAAAAASUVORK5CYII=')
    } else if (mcData.version['<=']('1.19.4')) {
      assert.strictEqual(window.slots[36].texture, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAABh0lEQVQoUz3SR05DQQwG4DmGQ4Alx6L3JnqNYMddgITQu6iBFYfiGxkhjd7zeOy/eKZMdWP2MiY6MdmN5bvYeWtMn8fMRWw8x9ZLY/Q0Js5i5aEuwVg7yvJ9rD/H0c+QtffRp2jhJuava79jneLh4xhvV9zF2yiKWp9N2aXbOPweFK8+1iKd4s2XsOTByYCuDFq3X+uxurmrKkxMGCqBlTV69j+bRRMix7IM6KR75KSKodt3vFPzFg+OCnF+GhJVaY4hYwHaNMMV/pJ2d9/7YBNjIYTNm7xZEZY1PLBXYKS+TKlARSs8qOlNkvJWr796UGQOhDm2d0YM6hyoLz1o8bgrfoqUjQoaiObHdu2ptv3fj4kDTRUFKi48lj0Bf8J6/SCQ8KMTiSmZZPEDBtJiBpUJwuMh34jqHLSjenF+6lIMNpdKqG2+K/D/YlTXt2TPaF6+BnoUUaInpRNp0GJB9aD04GuAuHwIqdg08y2SZBm/TlroLFhohS2bd6kNClRSkeedqMln+gt0aENEaxLcEwAAAABJRU5ErkJggg==')
    } else {
      assert.strictEqual(window.slots[36].texture, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAb1BMVEWGzCZ/xh5+xR18xBx8wxt7wxt6whp5wRp4wBl3vxl2vhl1vhh0vBhzvBhyuxhxuhhwuRhuuBhutxhtthhsthhrtRhqtBhpsxhoshhnsRhmsBhlrxhkrxhjrhhjrRhirRhirBhhrBhgqxhfqhheqRiQCqUtAAAAx0lEQVR42g3FWWKEIBAFwGemIcqiiLI0g6NA7n/GTP0U3vlT/VzYqH45dzXsFpAqxNo4/j35hKR4TLRFRVpPUBZ7XigmTyUQ7RkC9iz7vPTBju95vjqeXqiMdy4jx8Y1AfhdvD+dhAmA2pDzN0Oi8kLGvgSUfliYkjhy8+Fzg0OSo4e1WODQAMRLKZAyLxmd9deOq6xrTrOuhW0fySLl0cV0Dz87DdgGbSYI5eI4NJ0HAdPPHsjZBZJ506miFbHVRNOZjahF0j8SFRB3KHqPyQAAAABJRU5ErkJggg==')
    }
  })

  it('Tool durability', async function () {
    this.timeout(30 * 1000)

    const damage = 15
    if (mcData.version['<=']('1.12.2')) {
      bot.chat('/give test minecraft:golden_pickaxe 1 15')
    } else {
      bot.chat(`/give test minecraft:golden_pickaxe{Damage:${damage}} 1`)
    }
    await sleep(2000)
    assertWindow(window, 0, 'inventory')
    assert.strictEqual(window.slots[36].durabilityLeft, (32 - damage) / 32)
  })

  // TODO: Find another way to test unsupported windows. Using setFailStreak is really unstable
  // Opens and updates an unsupported window. The bot should receive inventory updates instead of updates from an unknown window
  // it('Unsupported window', async function () {
  //   this.timeout(30 * 1000)

  //   bot.chat(`/setblock ${container1Pos.toArray().join(' ')} minecraft:chest`)

  //   // Correct slots before opening the "unknown window"
  //   bot.chat('/give test dirt 16')
  //   await sleep(2000)
  //   assertWindow(window, 0, 'inventory')
  //   assert.equal(window.unsupported, undefined)
  //   assert.equal(window.realId, undefined)
  //   assert.equal(window.realType, undefined)
  //   assertSlotMatch(bot.inventory, window, 36, 'dirt', 16)

  //   // We want getWindowName to return null once to simulate an unknown window
  //   setFailStreak([true, false, true])

  //   // Open the "unknown window" and check that the items are shown in the correct slots of the inventory
  //   const chest = await bot.openContainer(bot.blockAt(container1Pos))
  //   await sleep(2000)
  //   assertWindow(window, 0, 'inventory')
  //   assert(window.unsupported)
  //   assert.strictEqual(window.realId, bot.currentWindow.id)
  //   assert.strictEqual(window.realType, bot.currentWindow.type)
  //   assertSlot(window.slots[36], 'dirt', 16)

  //   // Correct slots after receiving items while the "unknown window" is open
  //   bot.chat('/give test beef 1')
  //   await sleep(2000)
  //   assertWindow(window, 0, 'inventory')
  //   assert(window.unsupported)
  //   assert.strictEqual(window.realId, bot.currentWindow.id)
  //   assert.strictEqual(window.realType, bot.currentWindow.type)
  //   assertSlot(window.slots[37], 'beef', 1)

  //   // Correct slots after closing the "unknown window"
  //   chest.close()
  //   await sleep(2000)
  //   assertWindow(window, 0, 'inventory')
  //   assert.equal(window.unsupported, undefined)
  //   assert.equal(window.realId, undefined)
  //   assert.equal(window.realType, undefined)
  //   assertSlotMatch(bot.inventory, window, 36, 'dirt', 16)
  //   assertSlotMatch(bot.inventory, window, 37, 'beef', 1)
  // })

  // TODO: Check also that the item slot is set correctly (not only the position in the array)
})
