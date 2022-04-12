const path = require('path')
const fs = require('fs')

const windowNamesOrig = {
  inventory: ['minecraft:inventory'],
  chest: ['minecraft:generic_9x3', 'minecraft:chest'],
  'crafting-table': ['minecraft:crafting', 'minecraft:crafting_table'],
  furnace: ['minecraft:furnace'],
  'large-chest': ['minecraft:generic_9x6', 'minecraft:chest']
}
const windowNames = windowNamesOrig

// This is just to simulate a unsuported window on the tests
let failStreak = []
function setFailStreak (newFailStreak) {
  failStreak = newFailStreak
}

function getWindowName (window) {
  if (failStreak.shift()) return null

  // Until version 1.13 (included), chest and large chest had both the type 'minecraft:chest'
  // We determine which it is by it's number of slots
  if (window.type === 'minecraft:chest') {
    const slotCount = Object.keys(window.slots).length
    if (slotCount === 63) {
      return 'chest'
    } else {
      return 'large-chest'
    }
  }

  if (Object.keys(windowNames).includes(window.type)) return window.type
  return Object.keys(windowNames)[Object.values(windowNames).findIndex(e => e.includes(window.type))]
}

const metadataToColor = {
  wool: {
    0: 'white',
    1: 'orange',
    2: 'magenta',
    3: 'light_blue',
    4: 'yellow',
    5: 'lime',
    6: 'pink',
    7: 'gray',
    8: 'silver',
    9: 'cyan',
    10: 'purple',
    11: 'blue',
    12: 'brown',
    13: 'green',
    14: 'red',
    15: 'black'
  }
}

function addTexture (mcData, mcAssets, item) {
  if (!item) return item

  if (mcData.version['<=']('1.12.2') && item.name === 'wool') {
    const woolColor = metadataToColor.wool[item.metadata]
    const textureBase64 = fs.readFileSync(path.join(mcAssets.directory, 'blocks', 'wool_colored_' + woolColor + '.png')).toString('base64')
    item.texture = 'data:image/png;base64,' + textureBase64
  } else {
    item.texture = mcAssets.textureContent[item.name].texture
  }

  return item
}

module.exports = { getWindowName, setFailStreak, addTexture }
