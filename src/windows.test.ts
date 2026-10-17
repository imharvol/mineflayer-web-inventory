import { describe, expect, it } from 'vitest'
import { makeItem, withCustomName } from '../test/fixtures/items'
import {
  getWindowKind,
  PLAYER_PREFIX_SLOTS,
  SINGLE_CHEST_SLOTS,
  toInventorySlot,
  toInventorySlots,
} from './windows'

describe('getWindowKind', () => {
  it('maps the player inventory', () => {
    expect(getWindowKind('minecraft:inventory', 46)).toBe('inventory')
  })

  it('maps modern chest windows by provider type', () => {
    expect(getWindowKind('minecraft:generic_9x3', 63)).toBe('chest')
    expect(getWindowKind('minecraft:generic_9x6', 90)).toBe('large-chest')
  })

  it('disambiguates pre-1.13 chests by slot count', () => {
    expect(getWindowKind('minecraft:chest', SINGLE_CHEST_SLOTS)).toBe('chest')
    expect(getWindowKind('minecraft:chest', 90)).toBe('large-chest')
  })

  it('maps crafting tables and furnaces in both spellings', () => {
    expect(getWindowKind('minecraft:crafting', 46)).toBe('crafting-table')
    expect(getWindowKind('minecraft:crafting_table', 46)).toBe('crafting-table')
    expect(getWindowKind('minecraft:furnace', 39)).toBe('furnace')
  })

  it('accepts already-kind names like v1 did', () => {
    expect(getWindowKind('inventory', 46)).toBe('inventory')
  })

  it('returns null for unsupported windows', () => {
    expect(getWindowKind('minecraft:hopper', 41)).toBeNull()
    expect(getWindowKind('some-mod:custom_machine', 20)).toBeNull()
  })

  it('returns null for numeric provider types', () => {
    expect(getWindowKind(12, 46)).toBeNull()
  })
})

describe('toInventorySlot', () => {
  const chest = { inventoryStart: 27, inventoryEnd: 63 }

  it('maps the inventory start to the first prefixed slot', () => {
    expect(toInventorySlot(27, chest)).toBe(PLAYER_PREFIX_SLOTS)
  })

  it('maps the last inventory slot to the hotbar end', () => {
    expect(toInventorySlot(62, chest)).toBe(44)
  })
})

describe('toInventorySlots', () => {
  const hopper = {
    id: 7,
    slots: Array.from({ length: 41 }, (_, index) =>
      index === 5
        ? makeItem({ name: 'dirt', slot: 5, count: 16 })
        : index === 40
          ? makeItem({ name: 'melon', slot: 40 })
          : null,
    ),
    inventoryStart: 5,
    inventoryEnd: 41,
  }

  it('pads with the player prefix and re-indexes the inventory region', () => {
    const slots = toInventorySlots(hopper)

    expect(slots).toHaveLength(PLAYER_PREFIX_SLOTS + 36)
    expect(slots.slice(0, PLAYER_PREFIX_SLOTS)).toEqual(Array(9).fill(null))
    expect(slots[PLAYER_PREFIX_SLOTS]?.name).toBe('dirt')
    expect(slots[PLAYER_PREFIX_SLOTS]?.slot).toBe(PLAYER_PREFIX_SLOTS)
    expect(slots[44]?.name).toBe('melon')
    expect(slots[44]?.slot).toBe(44)
  })

  it('copies items instead of mutating mineflayer-owned objects', () => {
    const slots = toInventorySlots(hopper)
    const copied = slots[PLAYER_PREFIX_SLOTS]

    expect(copied).not.toBe(hopper.slots[5])
    expect(hopper.slots[5]?.slot).toBe(5)
  })

  it('carries getter-backed custom names into the copies', () => {
    const renamed = withCustomName(makeItem({ name: 'dirt', slot: 5, count: 16 }), 'Excalibur')
    const slots = toInventorySlots({
      id: 7,
      slots: Array.from({ length: 41 }, (_, index) => (index === 5 ? renamed : null)),
      inventoryStart: 5,
      inventoryEnd: 41,
    })

    expect(slots[PLAYER_PREFIX_SLOTS]?.customName).toBe('Excalibur')
  })

  it('leaves empty slots as null', () => {
    const slots = toInventorySlots(hopper)

    expect(slots[PLAYER_PREFIX_SLOTS + 1]).toBeNull()
    expect(slots[42]).toBeNull()
  })
})
