import { createServer as createHttpServer } from 'node:http'
import type { WindowMessage } from '@shared/messages'
import type { Bot } from 'mineflayer'
import { io as createClient, type Socket } from 'socket.io-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import inventoryViewer from '../../src/index'
import { makeItem } from '../fixtures/items'
import { FakeBot } from './fake-bot'
import { getFreePort } from './free-port'

/** FakeBot is a test double for the mineflayer Bot surface the plugin uses. */
const asBot = (fakeBot: FakeBot): Bot => fakeBot as unknown as Bot

function onceWindow(socket: Socket): Promise<WindowMessage> {
  return new Promise((resolve) =>
    socket.once('window', (message: WindowMessage) => resolve(message)),
  )
}

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('condition not met in time')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

describe('inventoryViewer (plugin entry)', () => {
  let bot: FakeBot
  let port: number
  const clients: Socket[] = []
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    bot = new FakeBot()
    port = await getFreePort()
  })

  afterEach(async () => {
    for (const client of clients.splice(0)) client.disconnect()
    const web = asBot(bot).webInventory
    if (web?.isRunning) await web.stop()
    logSpy.mockRestore()
  })

  function webInventory() {
    return asBot(bot).webInventory
  }

  function connect(socketPath: string): Socket {
    const client = createClient(`http://127.0.0.1:${port}`, {
      path: socketPath,
      reconnection: false,
      transports: ['websocket'],
    })
    clients.push(client)
    return client
  }

  it('attaches bot.webInventory with frozen options and starts on load by default', async () => {
    inventoryViewer(asBot(bot), { port })

    const web = webInventory()
    expect(web.options).toMatchObject({
      port,
      host: '127.0.0.1',
      webPath: '/',
      socketPath: '/socket.io',
      startOnLoad: true,
    })
    expect(Object.isFrozen(web.options)).toBe(true)

    await waitFor(() => web.isRunning)
    expect(web.isRunning).toBe(true)
  })

  it('honors startOnLoad: false and implements start/stop semantics', async () => {
    inventoryViewer(asBot(bot), { port, startOnLoad: false })
    const web = webInventory()
    expect(web.isRunning).toBe(false)

    await web.start()
    expect(web.isRunning).toBe(true)
    await expect(web.start()).rejects.toThrow(/already running/)

    await web.stop()
    expect(web.isRunning).toBe(false)
    await expect(web.stop()).rejects.toThrow(/not running/)
  })

  it('wires a non-root webPath through to the socket path', async () => {
    inventoryViewer(asBot(bot), { port, webPath: 'foo', startOnLoad: false })
    await webInventory().start()

    expect(webInventory().options.socketPath).toBe('/foo/socket.io')

    const client = connect('/foo/socket.io')
    const window = await onceWindow(client)
    expect(window.type).toBe('inventory')
  })

  it('accepts the legacy debounceTime alias and streams updates', async () => {
    inventoryViewer(asBot(bot), { port, debounceTime: 20, startOnLoad: false })
    await webInventory().start()

    const client = connect('/socket.io')
    await onceWindow(client)

    const updatePromise = new Promise<number>((resolve) =>
      client.once('windowUpdate', () => resolve(Date.now())),
    )
    const startedAt = Date.now()
    bot.inventory.updateSlot(36, makeItem({ name: 'dirt', count: 16 }))
    const updatedAt = await updatePromise
    expect(updatedAt - startedAt).toBeLessThan(1000)
  })

  it('disposes the tracker and stops the server when the bot ends', async () => {
    inventoryViewer(asBot(bot), { port, startOnLoad: false })
    await webInventory().start()
    const client = connect('/socket.io')
    await onceWindow(client)

    bot.quit()

    await waitFor(() => !webInventory().isRunning)
    expect(bot.inventory.listenerCount('updateSlot')).toBe(0)
    expect(bot.listenerCount('windowOpen')).toBe(0)
    expect(bot.listenerCount('windowClose')).toBe(0)
  })

  it('logs a failed startOnLoad instead of crashing', async () => {
    // Occupy the port so the automatic start fails.
    const occupied = await getFreePort()
    const blocker = createHttpServer()
    await new Promise<void>((resolve) => blocker.listen(occupied, '127.0.0.1', resolve))

    inventoryViewer(asBot(bot), { port: occupied })
    await waitFor(() =>
      logSpy.mock.calls.some((call: unknown[]) => String(call[0]).includes('Unable to start')),
    )
    expect(webInventory().isRunning).toBe(false)

    await new Promise<void>((resolve) => blocker.close(() => resolve()))

    await webInventory().start()
    expect(webInventory().isRunning).toBe(true)
  })
})
