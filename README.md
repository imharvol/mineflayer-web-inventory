# Mineflayer Web Inventory
A simple web-based inventory viewer for [mineflayer](https://github.com/PrismarineJS/mineflayer) with support for **multiple types of windows and updated in real-time**.

## Install
`npm install mineflayer-web-inventory`

[![npm version](https://badge.fury.io/js/mineflayer-web-inventory.svg)](https://badge.fury.io/js/mineflayer-web-inventory)

Note that from version 1.3.0 mineflayer-web-inventory will only support mineflayer 3.X.X versions
If you still wish to use mineflayer-web-inventory with mineflayer 2.X.X you can install mineflayer-web-inventory@1.2.1: `npm i mineflayer-web-inventory@1.2.1`

## Usage
- Run `npm install mineflayer-web-inventory`.
- Import mineflayer-web-inventory: `const inventoryViewer = require('mineflayer-web-inventory')`.
- Call inventoryViewer with your bot instance: `inventoryViewer(bot)`.

```js
const mineflayer = require('mineflayer')
const inventoryViewer = require('mineflayer-web-inventory')

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'bot'
})

inventoryViewer(bot)
```

This will start a web server in http://localhost:3000/.
You can change the options using:
```js
  let options = {
    port: PORT,
    path: PATH,
    express: EXPRESS,
    app: APP,
    http: HTTP,
    io: IO,
    startOnLoad: BOOLEAN,
    debounceTime: INT
  }

  inventoryViewer(bot, options)
```
You can access the options in bot.webInventory.options

#### bot.webInventory.start([cb])
Starts the web server. This function is called when the plugin is first loaded unless `options.startOnLoad` is `false`

#### bot.webInventory.stop([cb])
Stops the web server. You can check the current status of the web server using `bot.webInventory.isRunning` which returns a boolean

## Screenshots
![Example Screenshot 1](https://user-images.githubusercontent.com/17525823/128013976-493448e3-aa22-43bc-8fb9-428f1ccf9b5f.png)
![Example Screenshot 2](https://user-images.githubusercontent.com/17525823/128013983-31f50c2f-e453-401b-a697-d21682e0c980.png)

https://user-images.githubusercontent.com/17525823/128014178-6ea85f97-6698-43dc-9b1f-81a1802885d4.mp4

### Images
The images used in this project are from https://wiki.vg/Inventory and https://github.com/PrismarineJS/minecraft-assets