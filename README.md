# Mineflayer Web Inventory
## Usage
- Run `git clone https://github.com/ImHarvol/mineflayer-web-inventory.git` in your bot's folder.
- Run `npm install` inside ./mineflayer-web-inventory to install dependencies.
- Import ./mineflayer-web-inventory: `const inventoryViewer = require('./mineflayer-web-inventory')` in your bot's project.
- Call inventoryViewer with your bot instance: `inventoryViewer(bot)`.
```js
const mineflayer = require('mineflayer')
const inventoryViewer = require('./mineflayer-web-inventory')

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'bot'
})

inventoryViewer(bot)
```
This will start a web server in http://localhost:3000/.
You can change the port using: `inventoryViewer(bot, PORT)` instead.
