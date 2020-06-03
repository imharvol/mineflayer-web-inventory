# Mineflayer Web Inventory
A **very** simple web based inventory viewer for [mineflayer](https://github.com/PrismarineJS/mineflayer)

## Install
`npm install mineflayer-web-inventory`

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
You can change the port using: `inventoryViewer(bot, PORT)` instead.
