import type { ItemView, SlotIndex, WindowKind } from '@shared/messages'
import type { Item } from 'prismarine-item'
import { toItemView } from './items'

/** Total slots of a single chest window: 27 chest slots + 36 player slots. */
export const SINGLE_CHEST_SLOTS = 63

/**
 * Player-inventory slots that precede `inventoryStart`: 4 armor + 4 crafting
 * + 1 offhand. Explains v1's "9 empty slots" hack.
 */
export const PLAYER_PREFIX_SLOTS = 9

/** Provider window type → kind. Insertion order defines lookup precedence. */
const WINDOW_KINDS: Record<WindowKind, readonly string[]> = {
  inventory: ['minecraft:inventory'],
  chest: ['minecraft:generic_9x3', 'minecraft:chest'],
  'crafting-table': ['minecraft:crafting', 'minecraft:crafting_table'],
  furnace: ['minecraft:furnace'],
  'large-chest': ['minecraft:generic_9x6', 'minecraft:chest'],
}

export interface InventoryRange {
  inventoryStart: number
  inventoryEnd: number
}

export interface InventoryParts extends InventoryRange {
  id: number
  slots: ReadonlyArray<Item | null>
}

export function getWindowKind(providerType: string | number, slotCount: number): WindowKind | null {
  const type = String(providerType)

  // Until 1.13 (included), chests and large chests shared the type
  // 'minecraft:chest'; the slot count disambiguates them.
  if (type === 'minecraft:chest') {
    return slotCount === SINGLE_CHEST_SLOTS ? 'chest' : 'large-chest'
  }

  // Object.keys on a Record loses the key union; the values are WindowKind by construction.
  const kinds = Object.keys(WINDOW_KINDS) as WindowKind[]
  if (kinds.includes(type as WindowKind)) return type as WindowKind

  for (const kind of kinds) {
    if (WINDOW_KINDS[kind].includes(type)) return kind
  }
  return null
}

/** Translates a slot of an unsupported window into player-inventory coordinates. */
export function toInventorySlot(slot: SlotIndex, window: InventoryRange): SlotIndex {
  return slot - window.inventoryStart + PLAYER_PREFIX_SLOTS
}

/**
 * The player-inventory part of an unsupported window, re-indexed to player
 * inventory coordinates and padded with `PLAYER_PREFIX_SLOTS` empty slots.
 * Items are copies; mineflayer-owned objects are never mutated.
 */
export function toInventorySlots(window: InventoryParts): Array<ItemView | null> {
  const prefix: Array<ItemView | null> = Array.from({ length: PLAYER_PREFIX_SLOTS }, () => null)
  const inventory = window.slots
    .slice(window.inventoryStart, window.inventoryEnd)
    .map((item): ItemView | null =>
      item ? toItemView(item, { slot: toInventorySlot(item.slot, window) }) : null,
    )
  return [...prefix, ...inventory]
}
