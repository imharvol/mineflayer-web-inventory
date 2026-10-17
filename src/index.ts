import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Bot } from 'mineflayer'
import { loadAssets } from './assets'
import { createItemPresenter } from './items'
import { log } from './logger'
import { type InventoryOptions, type ResolvedOptions, resolveOptions } from './options'
import { createWebServer } from './server'
import { createWindowTracker } from './tracker'

const PACKAGE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const CLIENT_DIR = path.join(PACKAGE_ROOT, 'client', 'dist')

export interface WebInventory {
  readonly options: Readonly<ResolvedOptions>
  readonly isRunning: boolean
  start(): Promise<void>
  stop(): Promise<void>
}

declare module 'mineflayer' {
  interface Bot {
    webInventory: WebInventory
  }
}

/**
 * Attaches a live inventory web viewer to a mineflayer bot.
 * The server starts on load unless `startOnLoad` is `false`.
 */
export default function inventoryViewer(bot: Bot, options: InventoryOptions = {}): void {
  const resolved = resolveOptions(options)
  const bundle = loadAssets(bot.version)
  const presenter = createItemPresenter(bundle)
  const tracker = createWindowTracker(bot, presenter, resolved.windowUpdateDebounceTime)
  const server = createWebServer(
    { express: options.express, app: options.app, http: options.http, io: options.io },
    {
      webPath: resolved.webPath,
      socketPath: resolved.socketPath,
      port: resolved.port,
      host: resolved.host,
      staticDir: CLIENT_DIR,
    },
    tracker,
  )

  bot.webInventory = {
    options: resolved,
    get isRunning(): boolean {
      return server.isRunning
    },
    start: () => server.start(),
    stop: () => server.stop(),
  }

  function handleBotEnd(): void {
    tracker.dispose()
    server.stop().catch((error) => {
      log.warn('Unable to stop the inventory web server on bot end', error)
    })
  }
  bot.once('end', handleBotEnd)

  if (resolved.startOnLoad) {
    server.start().catch((error) => {
      log.error('Unable to start the inventory web server', error)
    })
  }
}

export type { InventoryOptions, ResolvedOptions } from './options'
