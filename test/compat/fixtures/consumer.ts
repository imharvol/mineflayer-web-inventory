import type { Bot } from 'mineflayer'
import type { InventoryOptions, ResolvedOptions, WebInventory } from 'mineflayer-web-inventory'
import plugin from 'mineflayer-web-inventory'
import { addItemData, getWindowName } from 'mineflayer-web-inventory/utils'

declare const bot: Bot

plugin(bot)
plugin(bot, {
  port: 3000,
  host: '127.0.0.1',
  webPath: '/foo',
  path: '/bar',
  debounceTime: 50,
  windowUpdateDebounceTime: 10,
  startOnLoad: false,
  express: undefined,
  app: undefined,
  http: undefined,
  io: undefined,
})

const web: WebInventory = bot.webInventory
const options: Readonly<ResolvedOptions> = web.options
const port: number = options.port
const socketPath: string = options.socketPath
const isRunning: boolean = web.isRunning
const startResult: Promise<void> = web.start()
const stopResult: Promise<void> = web.stop()

const inventoryOptions: InventoryOptions = { windowUpdateDebounceTime: 10 }

const kind: string | null = getWindowName({ type: 'minecraft:chest', slots: {} })

type AddItemDataArgs = Parameters<typeof addItemData>
declare const data: AddItemDataArgs[0]
declare const assets: AddItemDataArgs[1]
declare const item: AddItemDataArgs[2]
const view = addItemData(data, assets, item)
const viewName: string = view.name
const viewCount: number = view.count
const viewTexture: string | undefined = view.texture

void port
void socketPath
void isRunning
void startResult
void stopResult
void inventoryOptions
void kind
void viewName
void viewCount
void viewTexture
