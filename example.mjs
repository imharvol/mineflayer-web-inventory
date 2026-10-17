/**
 * This example starts a web server on localhost:3000 with a live representation
 * of the inventory of the mineflayer bot.
 *
 * Get this example from: https://raw.githubusercontent.com/ImHarvol/mineflayer-web-inventory/master/example.mjs
 * Install dependencies: npm i mineflayer mineflayer-web-inventory
 *
 * Usage: node example.mjs [<host>] [<port>] [<name>] [<password>]
 */

import mineflayer from 'mineflayer'
import inventoryViewer from 'mineflayer-web-inventory'

if (process.argv.length > 6) {
  console.log('Usage : node example.mjs [<host>] [<port>] [<name>] [<password>]')
  process.exit(1)
}

const bot = mineflayer.createBot({
  host: process.argv[2] || 'localhost',
  port: Number.parseInt(process.argv[3], 10) || 25565,
  username: process.argv[4] || 'web-inventory',
  password: process.argv[5],
})

inventoryViewer(bot)
