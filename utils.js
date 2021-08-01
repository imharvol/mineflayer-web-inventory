const windowNames = {
  inventory: ['minecraft:inventory'],
  chest: ['minecraft:generic_9x3'],
  'crafting-table': ['minecraft:crafting'],
  furnace: ['minecraft:furnace'],
  'large-chest': ['minecraft:generic_9x6']
}
function getWindowName (mName) {
  if (Object.keys(windowNames).includes(mName)) return mName
  return Object.keys(windowNames)[Object.values(windowNames).findIndex(e => e.includes(mName))]
}

module.exports = { getWindowName }
