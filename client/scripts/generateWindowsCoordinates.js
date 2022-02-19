const path = require('path')
const fsPromises = require('fs/promises')

const main = async () => {
  const outputFilePath = path.join(__dirname, '..', 'public', 'windows', 'coordinates.json')

  const windowSlotsCoords = {
    slotSize: 32,
    slotSeparation: 36,
    inventory: {},
    chest: {},
    'large-chest': {},
    'crafting-table': {},
    furnace: {}
  }

  windowSlotsCoords.inventory = {
    // Crafting slots
    0: [308, 56],
    1: [196, 36],
    2: [232, 36],
    3: [196, 72],
    4: [232, 72],

    5: [16, 16], // Helmet
    9: [16, 168], // Inventory
    18: [16, 204], // Inventory
    27: [16, 240], // Inventory
    36: [16, 284], // Tool bar
    45: [154, 124] // Left hand
  }
  // Add armor slots (5 - 8)
  for (let i = 5 + 1; i <= 8; i++) {
    windowSlotsCoords.inventory[i] = [windowSlotsCoords.inventory[i - 1][0], windowSlotsCoords.inventory[i - 1][1] + windowSlotsCoords.slotSeparation]
  }
  // Add inventory and tool bar slots
  for (let i = 9; i < 5 * 9; i += 9) {
    for (let j = 1; j <= 8; j++) {
      windowSlotsCoords.inventory[i + j] = [windowSlotsCoords.inventory[i][0] + windowSlotsCoords.slotSeparation * j, windowSlotsCoords.inventory[i][1]]
    }
  }

  windowSlotsCoords.chest = {
    // Chest slots
    0: [15, 35],
    9: [15, 71],
    18: [15, 107],
    // Inventory slots
    27: [15, 169],
    36: [15, 205],
    45: [15, 241],
    // Tool bar slots
    54: [15, 285]
  }
  for (let i = 0; i < 7 * 9; i += 9) {
    for (let j = 1; j <= 8; j++) {
      windowSlotsCoords.chest[i + j] = [windowSlotsCoords.chest[i][0] + windowSlotsCoords.slotSeparation * j, windowSlotsCoords.chest[i][1]]
    }
  }

  windowSlotsCoords['large-chest'] = {
    // Chest slots
    0: [15, 35],
    9: [15, 71],
    18: [15, 107],
    27: [15, 143],
    36: [15, 179],
    45: [15, 215],
    // Inventory slots
    54: [15, 277],
    63: [15, 313],
    72: [15, 349],
    // Tool bar slots
    81: [15, 393]
  }
  for (let i = 0; i < 10 * 9; i += 9) {
    for (let j = 1; j <= 8; j++) {
      windowSlotsCoords['large-chest'][i + j] = [windowSlotsCoords['large-chest'][i][0] + windowSlotsCoords.slotSeparation * j, windowSlotsCoords['large-chest'][i][1]]
    }
  }

  windowSlotsCoords['crafting-table'] = {
    0: [239, 61], // Output slot
    1: [59, 33], // Input slots
    4: [59, 69], // Input slots
    7: [59, 105], // Input slots
    // Inventory slots
    10: [15, 167],
    19: [15, 203],
    28: [15, 239],
    // Tool bar slots
    37: [15, 283]
  }
  // Add input slots (1-9)
  for (let i = 1; i < 3 * 3; i += 3) {
    for (let j = 1; j <= 2; j++) {
      windowSlotsCoords['crafting-table'][i + j] = [windowSlotsCoords['crafting-table'][i][0] + windowSlotsCoords.slotSeparation * j, windowSlotsCoords['crafting-table'][i][1]]
    }
  }
  // Add inventory slots (10-45)
  for (let i = 10; i < 5 * 9; i += 9) {
    for (let j = 1; j <= 8; j++) {
      windowSlotsCoords['crafting-table'][i + j] = [windowSlotsCoords['crafting-table'][i][0] + windowSlotsCoords.slotSeparation * j, windowSlotsCoords['crafting-table'][i][1]]
    }
  }

  windowSlotsCoords.furnace = {
    0: [111, 33], // Input slot
    1: [111, 105], // Fuel slot
    2: [223, 61], // Output slot
    // Inventory slots
    3: [15, 167],
    12: [15, 203],
    21: [15, 239],
    // Tool bar slots
    30: [15, 283]
  }
  // Add inventory slots (3-38)
  for (let i = 3; i < 4 * 9; i += 9) {
    for (let j = 1; j <= 8; j++) {
      windowSlotsCoords.furnace[i + j] = [windowSlotsCoords.furnace[i][0] + windowSlotsCoords.slotSeparation * j, windowSlotsCoords.furnace[i][1]]
    }
  }

  await fsPromises.writeFile(outputFilePath, JSON.stringify(windowSlotsCoords, null, 2))
}
main()
