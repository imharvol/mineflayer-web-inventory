# Inventory viewer
## Usage
- Run `git clone https://github.com/ImHarvol/inventory-viewer.git` in your bot's folder.
- Import inventory-viewer: `const inventoryViewer = require('./inventory-viewer')`.
- Call inventoryViewer after creating the bot: `inventoryViewer(bot)`.
```js
const mineflayer = require('mineflayer')
const inventoryViewer = require('./inventory-viewer')

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'bot'
})

inventoryViewer(bot)
```
This will start a web server in http://localhost:3000/.
You can change the port using: `inventoryViewer(bot, PORT)` instead.
