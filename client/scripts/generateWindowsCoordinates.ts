import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type SlotCoordinates = Record<number, [number, number]>

const SLOT_PITCH = 36

function addRow(
  coordinates: SlotCoordinates,
  startSlot: number,
  x: number,
  y: number,
  slots: number,
): void {
  for (let index = 0; index < slots; index++) {
    coordinates[startSlot + index] = [x + SLOT_PITCH * index, y]
  }
}

const windowSlotsCoordinates: Record<string, SlotCoordinates> = {
  inventory: {
    // Crafting slots
    0: [307, 55],
    1: [195, 35],
    2: [231, 35],
    3: [195, 71],
    4: [231, 71],
    // Armor slots
    5: [15, 15],
    6: [15, 51],
    7: [15, 87],
    8: [15, 123],
    // Main inventory
    9: [15, 167],
    18: [15, 203],
    27: [15, 239],
    // Hotbar
    36: [15, 283],
    // Offhand
    45: [153, 123],
  },
  chest: {
    // Chest slots
    0: [15, 35],
    9: [15, 71],
    18: [15, 107],
    // Inventory slots
    27: [15, 169],
    36: [15, 205],
    45: [15, 241],
    // Toolbar slots
    54: [15, 285],
  },
  'large-chest': {
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
    // Toolbar slots
    81: [15, 393],
  },
  'crafting-table': {
    // Output slot
    0: [239, 61],
    // Input slots
    1: [59, 33],
    4: [59, 69],
    7: [59, 105],
    // Inventory slots
    10: [15, 167],
    19: [15, 203],
    28: [15, 239],
    // Toolbar slots
    37: [15, 283],
  },
  furnace: {
    // Input slot
    0: [111, 33],
    // Fuel slot
    1: [111, 105],
    // Output slot
    2: [223, 61],
    // Inventory slots
    3: [15, 167],
    12: [15, 203],
    21: [15, 239],
    // Toolbar slots
    30: [15, 283],
  },
}

const inventory = windowSlotsCoordinates.inventory
if (!inventory) throw new Error('missing inventory coordinates')
addRow(inventory, 9, 15, 167, 9)
addRow(inventory, 18, 15, 203, 9)
addRow(inventory, 27, 15, 239, 9)
addRow(inventory, 36, 15, 283, 9)

const chest = windowSlotsCoordinates.chest
if (!chest) throw new Error('missing chest coordinates')
addRow(chest, 0, 15, 35, 9)
addRow(chest, 9, 15, 71, 9)
addRow(chest, 18, 15, 107, 9)
addRow(chest, 27, 15, 169, 9)
addRow(chest, 36, 15, 205, 9)
addRow(chest, 45, 15, 241, 9)
addRow(chest, 54, 15, 285, 9)

const largeChest = windowSlotsCoordinates['large-chest']
if (!largeChest) throw new Error('missing large chest coordinates')
addRow(largeChest, 0, 15, 35, 9)
addRow(largeChest, 9, 15, 71, 9)
addRow(largeChest, 18, 15, 107, 9)
addRow(largeChest, 27, 15, 143, 9)
addRow(largeChest, 36, 15, 179, 9)
addRow(largeChest, 45, 15, 215, 9)
addRow(largeChest, 54, 15, 277, 9)
addRow(largeChest, 63, 15, 313, 9)
addRow(largeChest, 72, 15, 349, 9)
addRow(largeChest, 81, 15, 393, 9)

const craftingTable = windowSlotsCoordinates['crafting-table']
if (!craftingTable) throw new Error('missing crafting table coordinates')
addRow(craftingTable, 1, 59, 33, 3)
addRow(craftingTable, 4, 59, 69, 3)
addRow(craftingTable, 7, 59, 105, 3)
addRow(craftingTable, 10, 15, 167, 9)
addRow(craftingTable, 19, 15, 203, 9)
addRow(craftingTable, 28, 15, 239, 9)
addRow(craftingTable, 37, 15, 283, 9)

const furnace = windowSlotsCoordinates.furnace
if (!furnace) throw new Error('missing furnace coordinates')
addRow(furnace, 3, 15, 167, 9)
addRow(furnace, 12, 15, 203, 9)
addRow(furnace, 21, 15, 239, 9)
addRow(furnace, 30, 15, 283, 9)

const outputFilePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'windows',
  'coordinates.json',
)

await fs.mkdir(path.dirname(outputFilePath), { recursive: true })
await fs.writeFile(outputFilePath, `${JSON.stringify(windowSlotsCoordinates, null, 2)}\n`)
