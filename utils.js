const path = require('path')
const fs = require('fs')

const rawMcData = require('minecraft-data')

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
  return Object.keys(windowNames)[
    Object.values(windowNames).findIndex((e) => e.includes(window.type))
  ]
}

function addItemData (mcData, mcAssets, item) {
  if (!item || !mcData) return item

  try {
    const blockModels = JSON.parse(fs.readFileSync(path.join(mcAssets.directory, 'blocks_models.json')))

    if (mcData.version['<=']('1.12.2')) {
      // Fixes the name
      const itemVariations = mcData.itemsByName[item.name]?.variations ?? mcData.blocksByName[item.name]?.variations
      if (itemVariations) { item.displayName = itemVariations.find(variation => variation.metadata === item.metadata).displayName }

      // Tries to fix the texture
      let minecraftName =
      rawMcData.legacy.pc.items[item.type + ':' + item.metadata]?.substr('minecraft:'.length)

      if (minecraftName) {
        if (minecraftName.includes('[')) minecraftName = minecraftName.substr(0, minecraftName.indexOf['['] - 1)

        if (blockModels[minecraftName]) {
          const assetName = Object.values(blockModels[minecraftName].textures)[0]

          try {
            const textureBase64 = fs
              .readFileSync(path.join(mcAssets.directory, assetName + '.png'))
              .toString('base64')
            item.texture = 'data:image/png;base64,' + textureBase64
          } catch (err) {
            // It wasn't found. This happens with pistons for example
          }
        }
      }
    }
  } catch (err) {
    console.log('mineflayer-web-inventory error. trying to continue')
    console.log(err)
  } finally {
    if (!item.texture) item.texture = mcAssets.textureContent[item.name].texture
  }

  // Add durability left
  let itemMaxDurability
  if ((itemMaxDurability = mcData.itemsByName[item.name]?.maxDurability) && item.durabilityUsed != null) {
    item.durabilityLeft = (itemMaxDurability - item.durabilityUsed) / itemMaxDurability
  }

  return item
}

module.exports = { getWindowName, setFailStreak, addItemData }
