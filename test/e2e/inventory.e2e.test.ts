import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { WindowMessage, WindowUpdateMessage } from '@shared/messages'
import minecraftAssets from 'minecraft-assets'
import minecraftData from 'minecraft-data'
import { download, type ServerProperties, WrapServer } from 'minecraft-wrap'
import mineflayer, { type Bot } from 'mineflayer'
import { io as createClient, type Socket } from 'socket.io-client'
import { Vec3 } from 'vec3'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { applyUpdate, applyWindow } from '../../client/src/lib/windowState'
import inventoryViewer from '../../src/index'
import { getFreePort } from '../integration/free-port'

const minecraftVersion = process.env.TEST_MC_VERSION ?? '1.21.4'
const serverRoot = fileURLToPath(new URL('../server', import.meta.url))
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const serverProperties: ServerProperties = {
  'level-type': 'FLAT',
  'spawn-npcs': 'false',
  'spawn-animals': 'false',
  'online-mode': 'false',
  gamemode: 'creative',
  'spawn-monsters': 'false',
  'generate-structures': 'false',
}

function assertWindowExists(window: WindowMessage | undefined): WindowMessage {
  if (!window) throw new Error('the socket did not send a window yet')
  return window
}

function assertWindow(
  window: WindowMessage | undefined,
  expectedId: number | false,
  expectedType: string | false,
): void {
  const actual = assertWindowExists(window)
  if (expectedId !== false) expect(actual.id).toBe(expectedId)
  if (expectedType !== false) expect(actual.type).toBe(expectedType)
}

function assertSlot(
  slot: { name?: string; count?: number; texture?: string } | null | undefined,
  expectedName: string | false,
  expectedCount: number | false,
  assertTexture = true,
): void {
  if (expectedName !== false) expect(slot?.name).toBe(expectedName)
  if (expectedCount !== false) expect(slot?.count).toBe(expectedCount)
  if (assertTexture) expect(slot?.texture).toBeTruthy()
}

interface SlotSource {
  slots: Array<{ name?: string; count?: number; texture?: string } | null>
}

function assertSlotMatch(
  mineflayerWindow: SlotSource,
  webWindow: WindowMessage,
  slotNumber: number,
  expectedName: string | false,
  expectedCount: number | false,
): void {
  assertSlot(mineflayerWindow.slots[slotNumber], expectedName, expectedCount, false)
  assertSlot(webWindow.slots[slotNumber], expectedName, expectedCount, true)
}

function assertNullSlotMatch(
  mineflayerWindow: SlotSource,
  webWindow: WindowMessage,
  slotNumber: number,
): void {
  expect(mineflayerWindow.slots[slotNumber]).toBeNull()
  expect(webWindow.slots[slotNumber]).toBeNull()
}

describe(`mineflayer-web-inventory e2e (${minecraftVersion})`, () => {
  let bot: Bot
  let socket: Socket | null = null
  let window: WindowMessage | undefined
  let rawWindowMessages: WindowMessage[] = []
  let rawUpdateMessages: WindowUpdateMessage[] = []

  let serverPort = 0
  let viewerPort = 0
  const botPosition = new Vec3(50.5, 4, 50.5)
  const container1Position = botPosition.floored().offset(0, 0, 1)
  const container2Position = botPosition.floored().offset(0, 0, 2)

  const jarFile = path.join(serverRoot, `${minecraftVersion}.jar`)
  const serverDir = path.join(serverRoot, minecraftVersion)
  const mcData = minecraftData(minecraftVersion)
  const server = new WrapServer(jarFile, serverDir)

  function assertCurrentWindow(): SlotSource {
    if (!bot.currentWindow) throw new Error('the bot has no open window')
    return bot.currentWindow
  }

  function requireCurrentWindowId(): number {
    if (!bot.currentWindow) throw new Error('the bot has no open window')
    return bot.currentWindow.id
  }

  function blockAtOrThrow(position: Vec3) {
    const block = bot.blockAt(position)
    if (!block) throw new Error(`no block at ${position.toString()}`)
    return block
  }

  function itemId(name: string): number {
    const item = mcData.itemsByName[name]
    if (!item) throw new Error(`unknown item: ${name}`)
    return item.id
  }

  async function ensureServerJar(): Promise<void> {
    if (fs.existsSync(jarFile)) return
    fs.mkdirSync(serverRoot, { recursive: true })
    await new Promise<void>((resolve, reject) => {
      download(minecraftVersion, jarFile, (error) => (error ? reject(error) : resolve()))
    })
  }

  beforeAll(async () => {
    serverPort = await getFreePort()
    viewerPort = await getFreePort()
    serverProperties['server-port'] = String(serverPort)

    await ensureServerJar()

    await new Promise<void>((resolve, reject) => {
      server.startServer(serverProperties, (error) => (error ? reject(error) : resolve()))
    })

    bot = mineflayer.createBot({
      host: 'localhost',
      port: serverPort,
      username: 'test',
      version: minecraftVersion,
      logErrors: true,
    })

    inventoryViewer(bot, { port: viewerPort, windowUpdateDebounceTime: 100 })

    await new Promise<void>((resolve) => {
      bot.once('spawn', () => {
        server.writeServer('op test\n')
        setTimeout(resolve, 10 * 1000)
      })
    })
  }, 300_000)

  beforeEach(async () => {
    window = undefined
    rawWindowMessages = []
    rawUpdateMessages = []

    bot.chat(
      `/setblock ${botPosition.floored().offset(0, -1, 0).toArray().join(' ')} minecraft:dirt`,
    )
    bot.chat(`/setblock ${container1Position.toArray().join(' ')} minecraft:air`)
    bot.chat(`/setblock ${container2Position.toArray().join(' ')} minecraft:air`)
    bot.chat('/kill @e[type=item]')
    bot.chat('/clear')
    bot.chat(`/tp ${botPosition.toArray().join(' ')}`)

    socket = createClient(`http://localhost:${viewerPort}/`).connect()

    socket.on('window', (message: WindowMessage) => {
      rawWindowMessages.push(message)
      window = applyWindow(window, message)
    })
    socket.on('windowUpdate', (message: WindowUpdateMessage) => {
      rawUpdateMessages.push(message)
      if (window) window = applyUpdate(window, message)
    })

    await new Promise<void>((resolve) => {
      socket?.on('connect', () => setTimeout(resolve, 5000))
    })
  }, 30_000)

  afterEach(async () => {
    window = undefined
    if (socket?.connected) {
      await new Promise<void>((resolve) => {
        socket?.on('disconnect', () => resolve())
        socket?.disconnect()
      })
    }
    socket = null
  })

  afterAll(async () => {
    socket?.close()
    bot?.quit()

    await new Promise<void>((resolve, reject) => {
      server.stopServer((error) => (error ? reject(error) : resolve()))
    })
    await new Promise<void>((resolve, reject) => {
      server.deleteServerData((error) => (error ? reject(error) : resolve()))
    })
  }, 180_000)

  it("sends an initial 'window' event matching the frozen wire shape", async () => {
    bot.chat('/give test pumpkin 32')
    bot.chat('/give test melon 16')
    bot.chat('/give test iron_helmet 1')
    await sleep(1000)

    await bot.equip(itemId('iron_helmet'), 'head')
    await sleep(1000)

    assertWindow(window, 0, 'inventory')
    assertSlotMatch(bot.inventory, assertWindowExists(window), 5, 'iron_helmet', 1)
    assertSlotMatch(bot.inventory, assertWindowExists(window), 36, 'pumpkin', 32)
    assertSlotMatch(bot.inventory, assertWindowExists(window), 37, 'melon', 16)

    const initial = rawWindowMessages.at(0)
    if (!initial) throw new Error('no raw window message captured')
    expect(initial.id).toBe(0)
    expect(initial.type).toBe('inventory')
    expect(Object.keys(initial.slots)).toHaveLength(bot.inventory.slots.length)

    const pumpkinUpdate = rawUpdateMessages.find((message) => message.slots[36]?.name === 'pumpkin')
    if (!pumpkinUpdate) throw new Error('no pumpkin update captured')
    const pumpkin = pumpkinUpdate.slots[36]
    expect(pumpkin).toMatchObject({ slot: 36, name: 'pumpkin', count: 32 })
    expect(Object.keys(pumpkin ?? {})).toEqual(
      expect.arrayContaining(['slot', 'name', 'displayName', 'count', 'texture']),
    )
  })

  it("sends 'windowUpdate' events", async () => {
    bot.chat('/give test dirt 16')
    await sleep(1000)

    assertWindow(window, 0, 'inventory')
    assertSlotMatch(bot.inventory, assertWindowExists(window), 36, 'dirt', 16)
    expect(rawUpdateMessages.length).toBeGreaterThan(0)
    expect(rawUpdateMessages.at(-1)?.id).toBe(0)
  })

  it('tracks chest updates using moveSlotItem', async () => {
    bot.chat(`/setblock ${container1Position.toArray().join(' ')} minecraft:chest`)

    bot.chat('/give test dirt 16')
    await sleep(2500)
    assertWindow(window, 0, 'inventory')
    assertSlotMatch(bot.inventory, assertWindowExists(window), 36, 'dirt', 16)

    const chest = await bot.openContainer(blockAtOrThrow(container1Position))
    await sleep(2000)
    assertWindow(window, requireCurrentWindowId(), 'chest')
    assertSlotMatch(assertCurrentWindow(), assertWindowExists(window), 54, 'dirt', 16)
    assertNullSlotMatch(assertCurrentWindow(), assertWindowExists(window), 36)

    bot.moveSlotItem(54, 0)
    await sleep(2000)
    assertWindow(window, requireCurrentWindowId(), 'chest')
    assertSlotMatch(assertCurrentWindow(), assertWindowExists(window), 0, 'dirt', 16)
    assertNullSlotMatch(assertCurrentWindow(), assertWindowExists(window), 54)

    bot.moveSlotItem(0, 56)
    await sleep(2000)
    assertSlotMatch(assertCurrentWindow(), assertWindowExists(window), 56, 'dirt', 16)
    assertNullSlotMatch(assertCurrentWindow(), assertWindowExists(window), 0)

    bot.chat('/give test pumpkin 32')
    await sleep(2000)
    assertSlot(assertWindowExists(window).slots[54], 'pumpkin', 32)
    assertSlotMatch(assertCurrentWindow(), assertWindowExists(window), 56, 'dirt', 16)

    chest.close()
    await sleep(2000)
    assertWindow(window, 0, 'inventory')
    assertSlotMatch(bot.inventory, assertWindowExists(window), 36, 'pumpkin', 32)
    assertSlotMatch(bot.inventory, assertWindowExists(window), 38, 'dirt', 16)
  })

  it('tracks chest updates using deposit and withdraw', async () => {
    bot.chat(`/setblock ${container1Position.toArray().join(' ')} minecraft:chest`)

    bot.chat('/give test dirt 16')
    await sleep(2500)
    const chest = await bot.openContainer(blockAtOrThrow(container1Position))
    await sleep(2000)
    assertWindow(window, requireCurrentWindowId(), 'chest')
    assertSlotMatch(assertCurrentWindow(), assertWindowExists(window), 54, 'dirt', 16)

    chest.deposit(itemId('dirt'), null, 16)
    await sleep(2000)
    assertWindow(window, requireCurrentWindowId(), 'chest')
    assertSlotMatch(assertCurrentWindow(), assertWindowExists(window), 0, 'dirt', 16)
    assertNullSlotMatch(assertCurrentWindow(), assertWindowExists(window), 54)

    chest.withdraw(itemId('dirt'), null, 16)
    await sleep(2000)
    assertSlotMatch(assertCurrentWindow(), assertWindowExists(window), 27, 'dirt', 16)
    assertNullSlotMatch(assertCurrentWindow(), assertWindowExists(window), 0)

    bot.chat('/give test pumpkin 32')
    await sleep(2000)
    assertSlotMatch(assertCurrentWindow(), assertWindowExists(window), 54, 'pumpkin', 32)
    assertSlotMatch(assertCurrentWindow(), assertWindowExists(window), 27, 'dirt', 16)

    chest.close()
  })

  it('tracks double chest updates', async () => {
    if (['1.8', '1.9', '1.10', '1.11', '1.12'].includes(bot.majorVersion)) {
      bot.chat(`/setblock ${container1Position.toArray().join(' ')} minecraft:chest`)
      bot.chat(`/setblock ${container2Position.toArray().join(' ')} minecraft:chest`)
    } else {
      bot.chat(
        `/setblock ${container1Position.toArray().join(' ')} minecraft:chest[facing=west,type=right]`,
      )
      bot.chat(
        `/setblock ${container2Position.toArray().join(' ')} minecraft:chest[facing=west,type=left]`,
      )
    }

    bot.chat('/give test dirt 16')
    await sleep(2500)
    const chest = await bot.openContainer(blockAtOrThrow(container1Position))
    await sleep(2000)
    assertWindow(window, requireCurrentWindowId(), 'large-chest')
    assertSlotMatch(assertCurrentWindow(), assertWindowExists(window), 81, 'dirt', 16)

    chest.deposit(itemId('dirt'), null, 16)
    await sleep(2000)
    assertWindow(window, requireCurrentWindowId(), 'large-chest')
    assertSlotMatch(assertCurrentWindow(), assertWindowExists(window), 0, 'dirt', 16)
    assertNullSlotMatch(assertCurrentWindow(), assertWindowExists(window), 81)

    chest.withdraw(itemId('dirt'), null, 16)
    await sleep(2000)
    assertSlotMatch(assertCurrentWindow(), assertWindowExists(window), 54, 'dirt', 16)
    assertNullSlotMatch(assertCurrentWindow(), assertWindowExists(window), 0)

    bot.chat('/give test pumpkin 32')
    await sleep(2000)
    assertSlotMatch(assertCurrentWindow(), assertWindowExists(window), 81, 'pumpkin', 32)
    assertSlotMatch(assertCurrentWindow(), assertWindowExists(window), 54, 'dirt', 16)

    chest.close()
  })

  it('tracks furnace updates through its own window', async () => {
    bot.chat(`/setblock ${container1Position.toArray().join(' ')} minecraft:furnace`)

    bot.chat('/give test coal 16')
    bot.chat('/give test beef 1')
    await sleep(2500)
    assertWindow(window, 0, 'inventory')

    const furnace = await bot.openFurnace(blockAtOrThrow(container1Position))
    await sleep(2000)
    assertWindow(window, requireCurrentWindowId(), 'furnace')
    assertSlotMatch(assertCurrentWindow(), assertWindowExists(window), 30, 'coal', 16)
    assertSlotMatch(assertCurrentWindow(), assertWindowExists(window), 31, 'beef', 1)

    furnace.putFuel(itemId('coal'), null, 16)
    await sleep(2000)
    assertSlotMatch(assertCurrentWindow(), assertWindowExists(window), 1, 'coal', 16)
    assertNullSlotMatch(assertCurrentWindow(), assertWindowExists(window), 30)

    furnace.putInput(itemId('beef'), null, 1)
    await sleep(2000)
    assertSlotMatch(assertCurrentWindow(), assertWindowExists(window), 0, 'beef', 1)

    await new Promise<void>((resolve) => {
      const furnaceUpdateHandler = () => {
        if (furnace.outputItem()) {
          furnace.removeListener('update', furnaceUpdateHandler)
          resolve()
        }
      }
      furnace.on('update', furnaceUpdateHandler)
    })

    await sleep(2000)
    assertSlotMatch(assertCurrentWindow(), assertWindowExists(window), 2, 'cooked_beef', 1)
    assertSlotMatch(assertCurrentWindow(), assertWindowExists(window), 1, 'coal', 15)

    furnace.takeOutput()
    await sleep(2000)
    assertSlotMatch(assertCurrentWindow(), assertWindowExists(window), 3, 'cooked_beef', 1)

    furnace.takeFuel()
    await sleep(2000)
    assertSlotMatch(assertCurrentWindow(), assertWindowExists(window), 4, 'coal', 15)

    furnace.close()
  })

  it('shows unsupported windows as player-inventory updates', async () => {
    bot.chat(`/setblock ${container1Position.toArray().join(' ')} minecraft:hopper`)
    bot.chat('/give test dirt 16')
    await sleep(2500)
    assertWindow(window, 0, 'inventory')

    const hopper = await bot.openContainer(blockAtOrThrow(container1Position))
    await sleep(2000)

    const snapshot = assertWindowExists(window)
    expect(snapshot.unsupported).toBe(true)
    expect(snapshot.realId).toBe(requireCurrentWindowId())
    expect(snapshot.realType).toBe('minecraft:hopper')
    expect(snapshot.id).toBe(0)
    expect(snapshot.type).toBe('inventory')
    expect(Object.keys(snapshot.slots)).toHaveLength(45)
    assertSlot(snapshot.slots[36], 'dirt', 16)

    bot.chat('/give test melon 1')
    await sleep(2000)
    assertSlot(assertWindowExists(window).slots[37], 'melon', 1)

    hopper.close()
    await sleep(2000)
    expect(assertWindowExists(window).unsupported).toBeUndefined()
    expect(assertWindowExists(window).realId).toBeUndefined()
    expect(assertWindowExists(window).realType).toBeUndefined()
    assertWindow(window, 0, 'inventory')
    assertSlotMatch(bot.inventory, assertWindowExists(window), 36, 'dirt', 16)
    assertSlotMatch(bot.inventory, assertWindowExists(window), 37, 'melon', 1)
  })

  it('renders legacy wool textures per version', async () => {
    if (mcData.version['<=']('1.12.2')) {
      bot.chat('/give test wool 3 5')
    } else {
      bot.chat('/give test lime_wool 3')
    }
    await sleep(2000)
    assertWindow(window, 0, 'inventory')

    if (mcData.version['<=']('1.12.2')) {
      assertSlotMatch(bot.inventory, assertWindowExists(window), 36, 'wool', 3)
    } else {
      assertSlotMatch(bot.inventory, assertWindowExists(window), 36, 'lime_wool', 3)
    }

    const texture = assertWindowExists(window).slots[36]?.texture
    const assets = minecraftAssets(minecraftVersion)
    if (!assets) throw new Error(`minecraft-assets has no ${minecraftVersion} data`)

    if (mcData.version['<=']('1.12.2')) {
      // Legacy textures come from the block model table plus the asset file.
      const textureFile = path.join(assets.directory, 'blocks', 'wool_colored_lime.png')
      expect(texture).toBe(
        `data:image/png;base64,${fs.readFileSync(textureFile).toString('base64')}`,
      )
    } else {
      // Modern textures pass through minecraft-assets unchanged.
      expect(texture).toBe(assets.textureContent.lime_wool?.texture)
    }
  })

  it('computes tool durability', async () => {
    const damage = 15
    if (mcData.version['<=']('1.12.2')) {
      bot.chat('/give test minecraft:golden_pickaxe 1 15')
    } else if (mcData.version['<']('1.20.5')) {
      bot.chat(`/give test minecraft:golden_pickaxe{Damage:${damage}} 1`)
    } else {
      bot.chat(`/give test minecraft:golden_pickaxe[damage=${damage}] 1`)
    }
    await sleep(2000)
    assertWindow(window, 0, 'inventory')

    const slot = assertWindowExists(window).slots[36]
    expect(slot?.name).toBe('golden_pickaxe')
    const maxDurability = mcData.itemsByName.golden_pickaxe?.maxDurability ?? 0
    if (damage > maxDurability) {
      // minecraft-data 3.117.0 reports maxDurability 1 for every durable item on
      // 1.20.6; the presenter must omit the ratio instead of emitting -14.
      expect(slot?.durabilityLeft).toBeUndefined()
    } else {
      expect(slot?.durabilityLeft).toBe((maxDurability - damage) / maxDurability)
    }
  })
})
