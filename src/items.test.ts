import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { makeItem, withCustomName } from '../test/fixtures/items'
import legacyFixture from '../test/fixtures/legacy-1.12.2.json'
import modernFixture from '../test/fixtures/modern-1.18.2.json'
import type { AssetsBundle, LegacyBlockModels, McAssets, McData } from './assets'
import { createItemPresenter, MAX_CUSTOM_NAME_LENGTH } from './items'

const fixturesDirectory = fileURLToPath(new URL('../test/fixtures/assets', import.meta.url))

interface Fixture {
  version: { minecraftVersion: string; isLegacy: boolean }
  itemsByName: McData['itemsByName']
  blocksByName: McData['blocksByName']
  textureContent: McAssets['textureContent']
  blockModels: LegacyBlockModels
}

function toBundle(fixture: Fixture): AssetsBundle {
  return {
    data: {
      version: {
        minecraftVersion: fixture.version.minecraftVersion,
        '<=': () => fixture.version.isLegacy,
      },
      itemsByName: fixture.itemsByName,
      blocksByName: fixture.blocksByName,
    },
    assets: { directory: fixturesDirectory, textureContent: fixture.textureContent },
    blockModels: fixture.blockModels,
  }
}

describe('createItemPresenter (modern version)', () => {
  const fixture: Fixture = modernFixture
  const presenter = createItemPresenter(toBundle(fixture))

  it('adds the texture from minecraft-assets', () => {
    const view = presenter.present(makeItem({ name: 'dirt' }))

    expect(view.texture).toBe(fixture.textureContent.dirt?.texture)
    expect(view.displayName).toBe('dirt')
  })

  it('returns a copy and never mutates the input item', () => {
    const item = makeItem({ name: 'dirt' })
    const view = presenter.present(item)

    expect(view).not.toBe(item)
    expect(item).not.toHaveProperty('texture')
  })

  it('omits the texture for unknown items instead of throwing (regression: #57)', () => {
    const view = presenter.present(makeItem({ name: 'definitely_unknown_item' }))

    expect(view.texture).toBeUndefined()
    expect(view.name).toBe('definitely_unknown_item')
  })

  it('omits the texture when the texture entry has no texture', () => {
    const view = presenter.present(makeItem({ name: 'no_texture_item' }))

    expect(view.texture).toBeUndefined()
  })

  it('computes durability left from the durability used', () => {
    const view = presenter.present(makeItem({ name: 'golden_pickaxe', durabilityUsed: 15 }))

    expect(view.durabilityLeft).toBe((32 - 15) / 32)
  })

  it('keeps a fully damaged tool at zero durability left', () => {
    const view = presenter.present(makeItem({ name: 'golden_pickaxe', durabilityUsed: 32 }))

    expect(view.durabilityLeft).toBe(0)
  })

  it('omits durability left when the data is inconsistent (1.20.6 data bug)', () => {
    // minecraft-data 3.117.0 reports maxDurability 1 for every durable item on
    // 1.20.6; the presenter must not emit (1 - damage) / 1 as a ratio.
    const broken = createItemPresenter(
      toBundle({ ...fixture, itemsByName: { golden_pickaxe: { maxDurability: 1 } } }),
    )

    const view = broken.present(makeItem({ name: 'golden_pickaxe', durabilityUsed: 15 }))

    expect(view.durabilityLeft).toBeUndefined()
  })

  it('does not compute durability left without a durability value', () => {
    const view = presenter.present(makeItem({ name: 'golden_pickaxe', durabilityUsed: null }))

    expect(view.durabilityLeft).toBeUndefined()
  })

  it('exposes an explicit durability override on the wire view', () => {
    const view = presenter.present(makeItem({ name: 'golden_pickaxe' }), 3)

    expect(view.durabilityUsed).toBe(3)
    expect(view.durabilityLeft).toBe((32 - 3) / 32)
  })

  it('keeps an anvil custom name that a spread would lose (prototype getter)', () => {
    const view = presenter.present(
      withCustomName(makeItem({ name: 'diamond_sword' }), '§6Excalibur'),
    )

    expect(view.customName).toBe('§6Excalibur')
  })

  it('caps custom names at the wire limit', () => {
    const view = presenter.present(
      withCustomName(makeItem({ name: 'diamond_sword' }), 'x'.repeat(300)),
    )

    expect(view.customName).toBe('x'.repeat(MAX_CUSTOM_NAME_LENGTH))
  })

  it('omits customName when the item has none', () => {
    const view = presenter.present(makeItem({ name: 'dirt' }))

    expect(view).not.toHaveProperty('customName')
  })
})

describe('createItemPresenter (legacy 1.12.2)', () => {
  const fixture: Fixture = legacyFixture
  const bundle = toBundle(fixture)

  it('fixes display names through block variations', () => {
    const view = createItemPresenter(bundle).present(
      makeItem({ name: 'wool', displayName: 'Wool', type: 35, metadata: 5 }),
    )

    expect(view.displayName).toBe('Lime Wool')
  })

  it('resolves legacy textures through block models', () => {
    const view = createItemPresenter(bundle).present(
      makeItem({ name: 'wool', type: 35, metadata: 5 }),
    )
    const bytes = fs.readFileSync(path.join(fixturesDirectory, 'blocks', 'wool_colored_lime.png'))

    expect(view.texture).toBe(`data:image/png;base64,${bytes.toString('base64')}`)
    expect(view.texture).not.toBe(fixture.textureContent.wool?.texture)
  })

  it('degrades to no texture when the block model file is missing', () => {
    const view = createItemPresenter(bundle).present(
      makeItem({ name: 'stone', type: 1, metadata: 0 }),
    )

    expect(view.texture).toBeUndefined()
  })

  it('reads each texture file at most once per presenter', () => {
    const spy = vi.spyOn(fs, 'readFileSync')
    const presenter = createItemPresenter(bundle)

    presenter.present(makeItem({ name: 'wool', type: 35, metadata: 5 }))
    presenter.present(makeItem({ name: 'wool', type: 35, metadata: 5 }))

    const textureReads = spy.mock.calls.filter(([file]) =>
      String(file).endsWith('wool_colored_lime.png'),
    )
    expect(textureReads).toHaveLength(1)
    spy.mockRestore()
  })

  it('never mutates the input item', () => {
    const item = makeItem({ name: 'wool', displayName: 'Wool', type: 35, metadata: 5 })

    createItemPresenter(bundle).present(item)

    expect(item.displayName).toBe('Wool')
    expect(item).not.toHaveProperty('texture')
  })

  it('keeps anvil custom names on legacy versions', () => {
    const view = createItemPresenter(bundle).present(
      withCustomName(makeItem({ name: 'wool', type: 35, metadata: 5 }), '§bSpecial'),
    )

    expect(view.customName).toBe('§bSpecial')
  })
})
