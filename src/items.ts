import fs from 'node:fs'
import path from 'node:path'
import type { ItemView } from '@shared/messages'
import type { Item } from 'prismarine-item'
import { type AssetsBundle, getLegacyItemName, isLegacyVersion } from './assets'
import { log } from './logger'

export interface ItemPresenter {
  present(item: Item | ItemView, durabilityUsed?: number | null): ItemView
}

export function createItemPresenter(bundle: AssetsBundle): ItemPresenter {
  const legacy = isLegacyVersion(bundle.data)
  // Per-texture base64 cache: each texture file is read at most once per process.
  const textureCache = new Map<string, string | null>()

  return {
    present(item, durabilityUsed) {
      const view: ItemView = { ...item }
      const used =
        durabilityUsed !== undefined ? durabilityUsed : (readItemDurability(item) ?? null)
      if (durabilityUsed !== undefined) view.durabilityUsed = durabilityUsed

      if (legacy) {
        try {
          applyLegacyName(view, bundle)
          applyLegacyTexture(view, bundle, textureCache)
        } catch (error) {
          log.warn(`Unable to complete legacy data for item "${view.name}"`, error)
        }
      }

      if (!view.texture) {
        const texture = bundle.assets.textureContent[view.name]?.texture
        if (texture) view.texture = texture
      }

      if (used != null) {
        const maxDurability = bundle.data.itemsByName[view.name]?.maxDurability
        // minecraft-data 3.117.0 reports maxDurability 1 for every durable item
        // on 1.20.6; a ratio outside [0, 1] is meaningless, so omit it instead
        // of drawing garbage.
        if (maxDurability && used >= 0 && used <= maxDurability) {
          view.durabilityLeft = (maxDurability - used) / maxDurability
        }
      }

      return view
    },
  }
}

/**
 * `durabilityUsed` is a prototype getter on prismarine items, so it does not
 * survive copying; reading it here also covers plain copies from the wire.
 */
export function readItemDurability(
  item: Item | ItemView | null | undefined,
): number | null | undefined {
  if (!item) return undefined
  try {
    return item.durabilityUsed ?? null
  } catch {
    // prismarine throws for registries without a durability location; degrade to "unknown".
    return undefined
  }
}

function applyLegacyName(view: ItemView, bundle: AssetsBundle): void {
  const variations =
    bundle.data.itemsByName[view.name]?.variations ??
    bundle.data.blocksByName[view.name]?.variations
  if (!variations) return

  const metadata = typeof view.metadata === 'number' ? view.metadata : 0
  const variation = variations.find((entry) => entry.metadata === metadata)
  if (variation) view.displayName = variation.displayName
}

function applyLegacyTexture(
  view: ItemView,
  bundle: AssetsBundle,
  cache: Map<string, string | null>,
): void {
  if (typeof view.type !== 'number') return
  const metadata = typeof view.metadata === 'number' ? view.metadata : 0

  const legacyName = getLegacyItemName(view.type, metadata)
  if (!legacyName) return

  // v1's bracket handling contained a typo (`indexOf['[']`) that silently
  // blanked bracketed names; preserved so textures stay identical to v1.
  if (legacyName.includes('[')) return

  const model = bundle.blockModels[legacyName]
  if (!model) return
  const assetPath = Object.values(model.textures)[0]
  if (!assetPath) return

  const dataUrl = readTextureDataUrl(bundle.assets.directory, assetPath, cache)
  if (dataUrl) view.texture = dataUrl
}

function readTextureDataUrl(
  directory: string,
  assetPath: string,
  cache: Map<string, string | null>,
): string | null {
  const cached = cache.get(assetPath)
  if (cached !== undefined) return cached

  let dataUrl: string | null = null
  try {
    const file = fs.readFileSync(path.join(directory, `${assetPath}.png`))
    dataUrl = `data:image/png;base64,${file.toString('base64')}`
  } catch {
    // Some models reference textures that are not shipped (pistons, for example).
  }
  cache.set(assetPath, dataUrl)
  return dataUrl
}
