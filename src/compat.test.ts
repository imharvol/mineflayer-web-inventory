import fs from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { makeItem } from '../test/fixtures/items'
import { loadAssets } from './assets'
import { addItemData, getWindowName } from './compat'

function slotObject(count: number): Record<number, unknown> {
  const slots: Record<number, unknown> = {}
  for (let index = 0; index < count; index++) slots[index] = null
  return slots
}

describe('getWindowName (v1 shape)', () => {
  it('takes provider types from the window object', () => {
    expect(getWindowName({ type: 'minecraft:chest', slots: slotObject(63) })).toBe('chest')
    expect(getWindowName({ type: 'minecraft:chest', slots: slotObject(90) })).toBe('large-chest')
    expect(getWindowName({ type: 'minecraft:furnace', slots: slotObject(39) })).toBe('furnace')
    expect(getWindowName({ type: 'minecraft:inventory', slots: slotObject(46) })).toBe('inventory')
  })

  it('returns null for unsupported windows', () => {
    expect(getWindowName({ type: 'minecraft:hopper', slots: slotObject(41) })).toBeNull()
  })
})

describe('addItemData (v1 shape)', () => {
  it('enriches items with names, textures and durability', () => {
    const bundle = loadAssets('1.12.2')

    const view = addItemData(
      bundle.data,
      bundle.assets,
      makeItem({ name: 'wool', type: 35, metadata: 5, count: 3 }),
    )

    expect(view.displayName).toBe('Lime Wool')
    expect(view.texture).toMatch(/^data:image\/png;base64,/)
    expect(view.count).toBe(3)
  })

  it('loads block models at most once per assets instance', () => {
    const bundle = loadAssets('1.12.2')
    // A fresh wrapper object so the presenter cache starts empty for this test.
    const assets = { ...bundle.assets }
    const spy = vi.spyOn(fs, 'readFileSync')

    addItemData(bundle.data, assets, makeItem({ name: 'wool', type: 35, metadata: 5 }))
    addItemData(bundle.data, assets, makeItem({ name: 'wool', type: 35, metadata: 5 }))

    const modelReads = spy.mock.calls.filter(([file]) =>
      String(file).endsWith('blocks_models.json'),
    )
    expect(modelReads).toHaveLength(1)
    spy.mockRestore()
  })
})
