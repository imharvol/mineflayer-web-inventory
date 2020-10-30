# Mineflayer Web Inventory
A **very** simple web based inventory viewer for [mineflayer](https://github.com/PrismarineJS/mineflayer) updated in real time.

## Install
`npm install mineflayer-web-inventory`

[![npm version](https://badge.fury.io/js/mineflayer-web-inventory.svg)](https://badge.fury.io/js/mineflayer-web-inventory)


## Usage
- Run `npm install mineflayer-web-inventory`.
- Import mineflayer-web-inventory: `const inventoryViewer = require('./mineflayer-web-inventory')`.
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
    startOnLoad: BOOLEAN
  }

  inventoryViewer(bot, options)
```
You can access the options in bot.webInventory.options

#### bot.webInventory.start([cb])
Starts the web server. This function is called when the plugin is first loaded unless `options.startOnLoad` is `false`

#### bot.webInventory.stop([cb])
Stops the web server. You can check the current status of the web server using `bot.webInventory.isRunning` which returns a boolean

## Screenshot
![Example Screenshot](https://i.imgur.com/iOKN3Y6.png)