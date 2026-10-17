import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_VERSION, isLegacyVersion, loadAssets } from './assets'

describe('loadAssets', () => {
  it('loads the requested version with block models', () => {
    const bundle = loadAssets('1.12.2')

    expect(bundle.data.version.minecraftVersion).toBe('1.12.2')
    expect(bundle.assets.directory).toContain('1.12')
    expect(Object.keys(bundle.blockModels).length).toBeGreaterThan(0)
    expect(isLegacyVersion(bundle.data)).toBe(true)
  })

  it('caches bundles per version', () => {
    expect(loadAssets('1.12.2')).toBe(loadAssets('1.12.2'))
  })

  it('falls back to the default version for unknown versions, with a warning', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const bundle = loadAssets('definitely-not-a-version')

    expect(isLegacyVersion(bundle.data)).toBe(false)
    expect(
      spy.mock.calls.some(([message]) => String(message).includes('Unable to load minecraft data')),
    ).toBe(true)
    spy.mockRestore()
  })

  it('falls back to the default version when bot.version is missing, with a warning', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const bundle = loadAssets(undefined)

    expect(bundle.data.version.minecraftVersion).toBe(DEFAULT_VERSION)
    expect(
      spy.mock.calls.some(([message]) => String(message).includes('bot.version is not set')),
    ).toBe(true)
    spy.mockRestore()
  })

  it('reports legacy versions honestly', () => {
    expect(isLegacyVersion(loadAssets('1.12.2').data)).toBe(true)
    expect(isLegacyVersion(loadAssets('1.18.2').data)).toBe(false)
  })
})
