# Inventory viewer
## Example
```js
const mineflayer = require('mineflayer')
const inventoryViewer = require('./inventory-viewer')

var bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'bot'
})

inventoryViewer(bot)
```
