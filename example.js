/**
 * This example starts a web server on localhost:3000 with a live representation
 * of the inventory of the Mineflayer bot
 *
 * Get this example from: https://raw.githubusercontent.com/ImHarvol/mineflayer-web-inventory/master/example.js
 * Install dependencies: npm i mineflayer mineflayer-web-inventory
 *
 * Usage: node example.js [<host>] [<port>] [<name>] [<password>]
 */

const mineflayer = require('mineflayer')
const inventoryViewer = require('mineflayer-web-inventory')

if (process.argv.length > 6) {
  console.log('Usage : node example.js [<host>] [<port>] [<name>] [<password>]')
  process.exit(1)
}

const bot = mineflayer.createBot({
  host: process.argv[2] || 'localhost',
  port: parseInt(process.argv[3]) || 25565,
  username: process.argv[4] || 'web-inventory',
  password: process.argv[5]
})

inventoryViewer(bot)
