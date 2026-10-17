import { createServer, type Server as HttpServer, type RequestListener } from 'node:http'
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/messages'
import express from 'express'
import { type Socket, Server as SocketIOServer } from 'socket.io'
import { log } from './logger'
import type { ExpressApp, ExpressFactory } from './options'
import type { WindowTracker } from './tracker'

export interface ServerDeps {
  express?: ExpressFactory
  app?: ExpressApp
  http?: HttpServer
  io?: SocketIOServer<ClientToServerEvents, ServerToClientEvents>
}

export interface ServerConfig {
  webPath: string
  socketPath: string
  port: number
  host: string
  staticDir: string
}

export interface WebServer {
  readonly isRunning: boolean
  /** Rejects when already running or when listen fails. */
  start(): Promise<void>
  /** Rejects when not running; resolves once the listener is closed. */
  stop(): Promise<void>
}

type ServerState = 'idle' | 'starting' | 'running' | 'stopping'

export function createWebServer(
  deps: ServerDeps,
  config: ServerConfig,
  tracker: WindowTracker,
): WebServer {
  const expressFactory = deps.express ?? express
  const app = deps.app ?? expressFactory()
  // An express app is a plain request listener; only the structural shape matters here.
  const http = deps.http ?? createServer(app as unknown as RequestListener)
  const io =
    deps.io ??
    new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(http, {
      path: config.socketPath,
    })

  app.use(config.webPath, expressFactory.static(config.staticDir))

  let state: ServerState = 'idle'
  let rejectStart: ((error: unknown) => void) | null = null

  function handleConnection(socket: Socket<ClientToServerEvents, ServerToClientEvents>): void {
    try {
      socket.emit('window', tracker.current)
      const unsubscribe = tracker.subscribe((message) => {
        if (message.kind === 'window') socket.emit('window', message.message)
        else socket.emit('windowUpdate', message.message)
      })
      socket.once('disconnect', unsubscribe)
    } catch (error) {
      log.warn('Unable to set up an inventory connection', error)
    }
  }

  io.on('connection', handleConnection)

  function handleHttpError(error: Error): void {
    if (state === 'starting' && rejectStart) {
      const reject = rejectStart
      rejectStart = null
      state = 'idle'
      reject(error)
      return
    }
    log.error('The inventory web server errored', error)
  }

  http.on('error', handleHttpError)

  function start(): Promise<void> {
    if (state !== 'idle') {
      return Promise.reject(
        new Error('(mineflayer-web-inventory) INFO: mineflayer-web-inventory is already running'),
      )
    }

    state = 'starting'
    return new Promise<void>((resolve, reject) => {
      rejectStart = reject
      try {
        http.listen({ port: config.port, host: config.host }, () => {
          rejectStart = null
          state = 'running'
          log.info(`Inventory web server running on ${config.host}:${config.port}`)
          resolve()
        })
      } catch (error) {
        rejectStart = null
        state = 'idle'
        reject(error)
      }
    })
  }

  function stop(): Promise<void> {
    if (state !== 'running') {
      return Promise.reject(
        new Error('(mineflayer-web-inventory) INFO: mineflayer-web-inventory is not running'),
      )
    }

    state = 'stopping'
    io.disconnectSockets(true)
    return new Promise<void>((resolve, reject) => {
      http.close((error) => {
        state = 'idle'
        if (error) {
          log.error('Unable to close the inventory web server', error)
          reject(error)
          return
        }
        log.info('Inventory web server closed')
        resolve()
      })
    })
  }

  return {
    get isRunning(): boolean {
      return state === 'running'
    },
    start,
    stop,
  }
}
