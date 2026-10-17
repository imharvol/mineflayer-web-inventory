# Mineflayer Web Inventory

A simple web-based inventory viewer for [mineflayer](https://github.com/PrismarineJS/mineflayer)
with support for **multiple types of windows, updated in real-time**, including custom
(anvil) item names.

[![npm version](https://badge.fury.io/js/mineflayer-web-inventory.svg)](https://badge.fury.io/js/mineflayer-web-inventory)

## Requirements

- Node.js >= 22.
- mineflayer >= 4 (developed and tested against mineflayer 4.39; the plugin only uses
  stable APIs, but only 4.39+ is covered by CI).

## Install

```sh
npm install mineflayer-web-inventory
```

The web app ships prebuilt: installing the package does not run any build step.

## Usage

Works from both CommonJS and ESM:

```js
// CommonJS
const mineflayer = require('mineflayer')
const inventoryViewer = require('mineflayer-web-inventory')

// ESM
// import mineflayer from 'mineflayer'
// import inventoryViewer from 'mineflayer-web-inventory'

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'bot',
  // Setting the bot's version is recommended so data and textures load correctly
  version: '1.21.4'
})

inventoryViewer(bot)
```

This starts the web viewer on <http://localhost:3000/>. Run the bundled example with
`node example.mjs`.

### Options

```js
inventoryViewer(bot, {
  port: 3000,
  host: '127.0.0.1',
  webPath: '/',
  startOnLoad: true,
  windowUpdateDebounceTime: 100
})
```

| Option | Default | Description |
| --- | --- | --- |
| `port` | `3000` | Port of the web server. |
| `host` | `'127.0.0.1'` | Interface to bind. Use `'0.0.0.0'` to expose it to your network (see security below). |
| `webPath` | `'/'` | Path the app is served from, e.g. `'/inventory'`. Socket.IO follows it. |
| `path` | — | Legacy alias of `webPath`. |
| `express` | `require('express')` | Express module to use. |
| `app` | `express()` | Express app to mount the UI on. |
| `http` | `http.createServer(app)` | HTTP server to listen with. |
| `io` | `socket.io(http)` | Socket.IO server; a supplied one is used as-is. |
| `startOnLoad` | `true` | Start the web server as soon as the plugin loads. |
| `windowUpdateDebounceTime` | `100` | Milliseconds to batch slot updates before sending them. |
| `debounceTime` | — | Legacy alias of `windowUpdateDebounceTime`. |

The normalized options are available (frozen) as `bot.webInventory.options`.

#### `bot.webInventory.start()`

Starts the web server. Called automatically when the plugin loads unless `startOnLoad`
is `false`. Returns a `Promise` that resolves once the HTTP server is listening (and
rejects when it is already running or the port is taken).

#### `bot.webInventory.stop()`

Stops the web server and disconnects connected browsers. Returns a `Promise` that
resolves once the listener is closed.

`bot.webInventory.isRunning` reports whether the server is currently running.

#### `bot.webInventory.screenshot([options])`

Renders the current window to a PNG server-side — the same drawing code and assets as
the web canvas — and resolves with it as a `Buffer`. No browser has to be connected.
With `path`, the PNG is also written to that file:

```js
const png = await bot.webInventory.screenshot({ path: 'inventory.png' })
```

The image contains what the canvas draws: the window background, items, stack counts
and durability bars. Tooltips and the item list are not part of it.

## Supported Minecraft versions

Any version supported by mineflayer and `minecraft-data`, including legacy versions
(1.8.x – 1.12.x get their legacy names and textures resolved). The CI matrix runs the
full mineflayer-tested version list weekly against real Minecraft servers; every pull
request covers 1.8.8, 1.12.2, 1.13.2, 1.18.2, 1.19.4, 1.20.6 and the latest release.

## Securing remote access

There is no authentication: anyone who can reach the port sees the bot's live
inventory. The server binds `127.0.0.1` by default for that reason. If you must expose
it, put it behind a reverse proxy that terminates TLS and enforces authentication
(e.g. an OAuth proxy or Basic auth), and set `host: '0.0.0.0'` only for that proxy.

## Upgrading from 1.x

The public API is unchanged: `inventoryViewer(bot, options)`, every option, and the
Socket.IO wire format all keep working (the wire format is treated as a versioned
public interface). What changes in 2.0.0:

- Node.js >= 22 is required.
- The server binds `127.0.0.1` by default; pass `host: '0.0.0.0'` for the old behavior.
- `webPath` now really works: Socket.IO is served under the same path.
- No install-time build; `package.json` `exports` only guarantees the root entry and
  the legacy `./utils` subpath (`getWindowName`, `addItemData` — kept for
  compatibility, prefer the plugin itself; `setFailStreak` was removed).
- The package is written in TypeScript and ships types for both module systems.

## Screenshots

![Example Screenshot 1](https://user-images.githubusercontent.com/17525823/128013976-493448e3-aa22-43bc-8fb9-428f1ccf9b5f.png)
![Example Screenshot 2](https://user-images.githubusercontent.com/17525823/128013983-31f50c2f-e453-401b-a697-d21682e0c980.png)

https://user-images.githubusercontent.com/17525823/128014178-6ea85f97-6698-43dc-9b1f-81a1802885d4.mp4

### Images

The images used in this project are from https://wiki.vg/Inventory and https://github.com/PrismarineJS/minecraft-assets
