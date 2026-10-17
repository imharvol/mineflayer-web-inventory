/**
 * Regenerates the JSON fixtures under test/fixtures from real minecraft-data
 * and minecraft-assets output:
 *
 *   npx tsx test/fixtures/capture.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import minecraftAssets from 'minecraft-assets'
import minecraftData from 'minecraft-data'

const fixturesDir = path.dirname(fileURLToPath(import.meta.url))
const assetsDirectory = path.join(fixturesDir, 'assets')

// 1x1 transparent PNG: fixture textures only need bytes to read and cache.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

function writeJson(name: string, value: unknown): void {
  fs.writeFileSync(path.join(fixturesDir, name), `${JSON.stringify(value, null, 2)}\n`)
}

function requireTexture(version: string, name: string): { texture?: string } {
  const entry = minecraftAssets(version)?.textureContent[name]
  if (!entry?.texture) throw new Error(`minecraft-assets has no texture for "${name}" (${version})`)
  return entry
}

const legacyVersion = '1.12.2'
const legacy = minecraftData(legacyVersion)
const legacyAssets = minecraftAssets(legacyVersion)
if (!legacyAssets) throw new Error(`minecraft-assets has no ${legacyVersion} data`)
const legacyBlockModels = JSON.parse(
  fs.readFileSync(path.join(legacyAssets.directory, 'blocks_models.json'), 'utf8'),
) as Record<string, { textures: Record<string, string> }>

fs.mkdirSync(path.join(assetsDirectory, 'blocks'), { recursive: true })
fs.writeFileSync(
  path.join(assetsDirectory, 'blocks', 'wool_colored_lime.png'),
  Buffer.from(TINY_PNG_BASE64, 'base64'),
)

writeJson('legacy-1.12.2.json', {
  version: {
    minecraftVersion: legacy.version.minecraftVersion,
    isLegacy: legacy.version['<=']('1.12.2'),
  },
  itemsByName: {
    wool: { variations: legacy.itemsByName.wool?.variations },
    golden_pickaxe: { maxDurability: legacy.itemsByName.golden_pickaxe?.maxDurability },
    dirt: {},
  },
  blocksByName: {
    wool: { variations: legacy.blocksByName.wool?.variations },
  },
  textureContent: {
    wool: requireTexture(legacyVersion, 'wool'),
    dirt: requireTexture(legacyVersion, 'dirt'),
    no_texture_item: { name: 'no_texture_item' },
  },
  blockModels: {
    lime_wool: legacyBlockModels.lime_wool,
    stone: { textures: { all: 'blocks/missing_texture' } },
  },
})

const modernVersion = '1.18.2'
const modern = minecraftData(modernVersion)
const modernAssets = minecraftAssets(modernVersion)
if (!modernAssets) throw new Error(`minecraft-assets has no ${modernVersion} data`)

writeJson('modern-1.18.2.json', {
  version: {
    minecraftVersion: modern.version.minecraftVersion,
    isLegacy: modern.version['<=']('1.12.2'),
  },
  itemsByName: {
    golden_pickaxe: { maxDurability: modern.itemsByName.golden_pickaxe?.maxDurability },
  },
  blocksByName: {},
  textureContent: {
    dirt: requireTexture(modernVersion, 'dirt'),
    pumpkin: requireTexture(modernVersion, 'pumpkin'),
    golden_pickaxe: requireTexture(modernVersion, 'golden_pickaxe'),
    no_texture_item: { name: 'no_texture_item' },
  },
  blockModels: {},
})

console.log(`Fixtures written to ${fixturesDir}`)
