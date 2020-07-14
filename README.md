# Mineflayer Web Inventory
A **very** simple web based inventory viewer for [mineflayer](https://github.com/PrismarineJS/mineflayer) updated in real time.

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
You can change the options using:
```js
  let options = {
    port: PORT,
    path: PATH,
    express: EXPRESS,
    app: APP,
    http: HTTP,
    io: IO
  }

  inventoryViewer(bot, options)
```

## Screenshot
![Example Screenshot](https://i.imgur.com/iOKN3Y6.png)