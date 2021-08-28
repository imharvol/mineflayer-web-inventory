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

module.exports = { getWindowName, setFailStreak }
