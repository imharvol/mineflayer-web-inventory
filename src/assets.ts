import fs from 'node:fs'
import path from 'node:path'
import minecraftAssets from 'minecraft-assets'
import minecraftData from 'minecraft-data'
import { log } from './logger'

export const DEFAULT_VERSION = '1.18'

/** The narrow slice of minecraft-data this package consumes. */
export interface McData {
  version: {
    minecraftVersion: string
    '<='(other: string): boolean
  }
  itemsByName: Record<string, McDataEntry | undefined>
  blocksByName: Record<string, McDataEntry | undefined>
}

export interface McDataEntry {
  variations?: ReadonlyArray<{ metadata: number; displayName: string }>
  maxDurability?: number
}

export interface McAssetsEntry {
  name?: string
  texture?: string
}

/** The narrow slice of minecraft-assets this package consumes. */
export interface McAssets {
  directory: string
  textureContent: Record<string, McAssetsEntry | undefined>
}

export interface LegacyBlockModel {
  textures: Record<string, string>
}

export type LegacyBlockModels = Record<string, LegacyBlockModel>

export interface AssetsBundle {
  data: McData
  assets: McAssets
  blockModels: LegacyBlockModels
}

interface MinecraftDataLegacy {
  pc: { items: Record<string, string> }
}

// Process-lifetime cache; assets are immutable and loading is expensive.
const bundleCache = new Map<string, AssetsBundle>()

export function loadAssets(version: string | undefined): AssetsBundle {
  const requested = version?.trim() || undefined

  if (requested) {
    const cached = bundleCache.get(requested)
    if (cached) return cached

    const bundle = tryLoadBundle(requested)
    if (bundle) {
      bundleCache.set(requested, bundle)
      return bundle
    }

    log.warn(
      `Unable to load minecraft data for version "${requested}". ` +
        `Please specify a valid bot.version; using "${DEFAULT_VERSION}" instead`,
    )
  } else {
    log.warn(
      `bot.version is not set; using "${DEFAULT_VERSION}". ` +
        'mineflayer-web-inventory may not work properly',
    )
  }

  const fallback = tryLoadBundle(DEFAULT_VERSION)
  if (!fallback) {
    throw new Error(
      `(mineflayer-web-inventory) Unable to load minecraft data for version ` +
        `"${requested ?? DEFAULT_VERSION}". Check that minecraft-data and minecraft-assets ` +
        'support this version',
    )
  }
  bundleCache.set(DEFAULT_VERSION, fallback)
  return fallback
}

function tryLoadBundle(version: string): AssetsBundle | null {
  const cached = bundleCache.get(version)
  if (cached) return cached

  const data = tryLoad(() => minecraftData(version) as McData | null)
  const assets = tryLoad(() => minecraftAssets(version) as McAssets | null)
  if (!data || !assets) return null

  return { data, assets, blockModels: loadBlockModels(assets.directory) }
}

function tryLoad<T>(load: () => T | null): T | null {
  try {
    return load()
  } catch {
    return null
  }
}

/** Legacy versions code item names, display names and textures via item metadata. */
export function isLegacyVersion(data: McData): boolean {
  return data.version['<=']('1.12.2')
}

export function loadBlockModels(directory: string): LegacyBlockModels {
  try {
    const raw = fs.readFileSync(path.join(directory, 'blocks_models.json'), 'utf8')
    return JSON.parse(raw) as LegacyBlockModels
  } catch (error) {
    // Only legacy texture resolution needs block models; modern versions just skip them.
    log.warn(`Unable to read block models from "${directory}"`, error)
    return {}
  }
}

/**
 * v1 resolved legacy texture names through `minecraft-data`'s legacy table
 * (`"<type>:<metadata>"` → `"minecraft:<name>"`).
 */
export function getLegacyItemName(type: number, metadata: number): string | undefined {
  // minecraft-data's published types only describe `legacy.pc.blocks`.
  const legacy = minecraftData.legacy as unknown as MinecraftDataLegacy
  return legacy.pc.items[`${type}:${metadata}`]?.slice('minecraft:'.length)
}
