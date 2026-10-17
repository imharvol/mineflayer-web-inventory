import type { Server as HttpServer } from 'node:http'
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/messages'
import type { Server as SocketIOServer } from 'socket.io'

export type ExpressHandler = (req: unknown, res: unknown, next?: (error?: unknown) => void) => void

export interface ExpressApp {
  use(path: string, ...handlers: ExpressHandler[]): unknown
}

export interface ExpressFactory {
  (): ExpressApp
  static(root: string): ExpressHandler
}

export interface InventoryOptions {
  port?: number
  host?: string
  webPath?: string
  path?: string
  express?: ExpressFactory
  app?: ExpressApp
  http?: HttpServer
  io?: SocketIOServer<ClientToServerEvents, ServerToClientEvents>
  startOnLoad?: boolean
  windowUpdateDebounceTime?: number
  debounceTime?: number
}

export interface ResolvedOptions {
  port: number
  host: string
  webPath: string
  socketPath: string
  startOnLoad: boolean
  windowUpdateDebounceTime: number
}

export const DEFAULT_PORT = 3000
export const DEFAULT_HOST = '127.0.0.1'
export const DEFAULT_DEBOUNCE_TIME = 100

/** Makes a web path absolute and free of trailing slashes; `'/'` stays `'/'`. */
export function normalizeWebPath(input: string): string {
  const withLeadingSlash = input.startsWith('/') ? input : `/${input}`
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, '')
  return withoutTrailingSlash === '' ? '/' : withoutTrailingSlash
}

/** The Socket.IO path the browser app derives from `window.location.pathname`. */
export function toSocketPath(webPath: string): string {
  return webPath === '/' ? '/socket.io' : `${webPath}/socket.io`
}

export function resolveOptions(options: InventoryOptions): Readonly<ResolvedOptions> {
  const webPath = normalizeWebPath(options.webPath ?? options.path ?? '/')
  return Object.freeze({
    port: options.port ?? DEFAULT_PORT,
    host: options.host ?? DEFAULT_HOST,
    webPath,
    socketPath: toSocketPath(webPath),
    startOnLoad: options.startOnLoad !== false,
    windowUpdateDebounceTime:
      options.windowUpdateDebounceTime ?? options.debounceTime ?? DEFAULT_DEBOUNCE_TIME,
  })
}
