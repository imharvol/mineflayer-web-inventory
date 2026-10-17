import fs from 'node:fs'
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import type { WindowMessage, WindowUpdateMessage } from '@shared/messages'
import { Server as SocketIOServer } from 'socket.io'
import { io as createClient, type Socket } from 'socket.io-client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { ItemPresenter } from '../../src/items'
import { createWebServer, type WebServer } from '../../src/server'
import { createWindowTracker, type WindowTracker } from '../../src/tracker'
import { makeItem } from '../fixtures/items'
import { FakeBot } from './fake-bot'
import { getFreePort } from './free-port'

const stubPresenter: ItemPresenter = {
  present: (item) => ({ ...item, displayName: `web:${item.name}` }),
}

function onceWindow(socket: Socket): Promise<WindowMessage> {
  return new Promise((resolve) =>
    socket.once('window', (message: WindowMessage) => resolve(message)),
  )
}

function onceWindowUpdate(socket: Socket): Promise<WindowUpdateMessage> {
  return new Promise((resolve) =>
    socket.once('windowUpdate', (message: WindowUpdateMessage) => resolve(message)),
  )
}

function onceEvent(socket: Socket, event: 'connect' | 'disconnect'): Promise<void> {
  return new Promise((resolve) => socket.once(event, () => resolve()))
}

describe('createWebServer', () => {
  let staticDir: string
  let bot: FakeBot
  let tracker: WindowTracker
  let server: WebServer | null = null
  let port: number
  let http: HttpServer | null = null
  const clients: Socket[] = []

  beforeAll(() => {
    staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-inventory-static-'))
    fs.writeFileSync(path.join(staticDir, 'index.html'), '<html>inventory</html>')
    fs.writeFileSync(path.join(staticDir, 'hello.txt'), 'hello')
  })

  afterAll(() => {
    fs.rmSync(staticDir, { recursive: true, force: true })
  })

  beforeEach(async () => {
    bot = new FakeBot()
    tracker = createWindowTracker(bot, stubPresenter, 10)
    port = await getFreePort()
  })

  afterEach(async () => {
    for (const client of clients.splice(0)) client.disconnect()
    if (server?.isRunning) await server.stop()
    server = null
    if (http) {
      closeHttpServer(http)
      http = null
    }
    tracker.dispose()
  })

  function closeHttpServer(target: HttpServer): void {
    try {
      target.close()
    } catch {
      // Already closed by the server under test.
    }
  }

  function connect(socketPath: string, targetPort = port): Socket {
    const client = createClient(`http://127.0.0.1:${targetPort}`, {
      path: socketPath,
      reconnection: false,
      transports: ['websocket'],
    })
    clients.push(client)
    return client
  }

  function startServer(
    options: {
      webPath?: string
      socketPath?: string
      deps?: Parameters<typeof createWebServer>[0]
      targetPort?: number
    } = {},
  ): WebServer {
    const created = createWebServer(
      options.deps ?? {},
      {
        webPath: options.webPath ?? '/',
        socketPath: options.socketPath ?? '/socket.io',
        port: options.targetPort ?? port,
        host: '127.0.0.1',
        staticDir,
      },
      tracker,
    )
    server = created
    return created
  }

  it('serves static files at the configured web path', async () => {
    startServer({ webPath: '/' })
    await server?.start()

    const index = await fetch(`http://127.0.0.1:${port}/`)
    expect(await index.text()).toContain('inventory')

    const hello = await fetch(`http://127.0.0.1:${port}/hello.txt`)
    expect(await hello.text()).toBe('hello')
  })

  it('serves static files under a non-root web path', async () => {
    startServer({ webPath: '/foo', socketPath: '/foo/socket.io' })
    await server?.start()

    const hello = await fetch(`http://127.0.0.1:${port}/foo/hello.txt`)
    expect(await hello.text()).toBe('hello')

    const root = await fetch(`http://127.0.0.1:${port}/hello.txt`)
    expect(root.status).toBe(404)
  })

  it('exposes the socket endpoint at the configured socket path', async () => {
    startServer({ webPath: '/foo', socketPath: '/foo/socket.io' })
    await server?.start()

    const client = connect('/foo/socket.io')
    const window = await onceWindow(client)
    expect(window.type).toBe('inventory')
  })

  it('does not answer on the default socket path when a custom one is configured', async () => {
    startServer({ webPath: '/foo', socketPath: '/foo/socket.io' })
    await server?.start()

    const client = connect('/socket.io')
    const error = await new Promise<Error>((resolve) => client.once('connect_error', resolve))
    expect(error).toBeInstanceOf(Error)
  })

  it('primes new sockets with the current window and streams updates', async () => {
    startServer()
    await server?.start()

    // Change the inventory before connecting to prove priming reads live state.
    bot.inventory.updateSlot(36, makeItem({ name: 'dirt', count: 16 }))

    const client = connect('/socket.io')
    const window = await onceWindow(client)
    expect(window.id).toBe(0)
    expect(window.type).toBe('inventory')
    expect(window.slots[36]?.count).toBe(16)
    expect(Object.keys(window.slots)).toHaveLength(46)

    const updatePromise = onceWindowUpdate(client)
    bot.inventory.updateSlot(37, makeItem({ name: 'melon', count: 1 }))
    const update = await updatePromise

    expect(update.id).toBe(0)
    expect(update.slots[37]?.displayName).toBe('web:melon')
  })

  it('broadcasts the same updates to every connected socket', async () => {
    startServer()
    await server?.start()

    const first = connect('/socket.io')
    const second = connect('/socket.io')
    await Promise.all([onceWindow(first), onceWindow(second)])

    const updates = Promise.all([onceWindowUpdate(first), onceWindowUpdate(second)])
    bot.inventory.updateSlot(36, makeItem({ name: 'dirt' }))
    const [firstUpdate, secondUpdate] = await updates

    expect(firstUpdate.slots[36]?.name).toBe('dirt')
    expect(secondUpdate).toEqual(firstUpdate)
  })

  it('keeps bot listener counts stable across socket connect/disconnect cycles', async () => {
    startServer()
    await server?.start()

    for (let cycle = 0; cycle < 5; cycle++) {
      const client = connect('/socket.io')
      await onceWindow(client)
      const disconnected = onceEvent(client, 'disconnect')
      client.disconnect()
      await disconnected
    }

    expect(bot.inventory.listenerCount('updateSlot')).toBe(1)
    expect(bot.listenerCount('windowOpen')).toBe(1)
    expect(bot.listenerCount('windowClose')).toBe(1)
  })

  it('implements the start/stop state machine and supports restart', async () => {
    startServer()

    await server?.start()
    expect(server?.isRunning).toBe(true)

    await expect(server?.start()).rejects.toThrow(/already running/)

    await server?.stop()
    expect(server?.isRunning).toBe(false)

    await expect(server?.stop()).rejects.toThrow(/not running/)

    await server?.start()
    expect(server?.isRunning).toBe(true)
    const client = connect('/socket.io')
    await onceWindow(client)
  })

  it('disconnects clients on stop', async () => {
    startServer()
    await server?.start()
    const client = connect('/socket.io')
    await onceWindow(client)

    const disconnected = onceEvent(client, 'disconnect')
    await server?.stop()
    await disconnected
  })

  it('rejects start and stays idle when the port is taken', async () => {
    const occupier = createHttpServer()
    await new Promise<void>((resolve) => occupier.listen(port, '127.0.0.1', resolve))

    startServer()
    await expect(server?.start()).rejects.toThrow()
    expect(server?.isRunning).toBe(false)

    await new Promise<void>((resolve) => occupier.close(() => resolve()))

    await server?.start()
    expect(server?.isRunning).toBe(true)
  })

  it('uses a supplied socket.io server as-is', async () => {
    const userHttp = createHttpServer()
    const userIo = new SocketIOServer(userHttp, { path: '/custom/socket.io' })
    http = userHttp

    startServer({ deps: { http: userHttp, io: userIo } })
    await server?.start()

    const client = connect('/custom/socket.io')
    const window = await onceWindow(client)
    expect(window.type).toBe('inventory')
  })
})
