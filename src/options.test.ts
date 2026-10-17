import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DEBOUNCE_TIME,
  DEFAULT_HOST,
  DEFAULT_PORT,
  normalizeWebPath,
  resolveOptions,
  toSocketPath,
} from './options'

describe('normalizeWebPath', () => {
  it('keeps the root path as "/"', () => {
    expect(normalizeWebPath('/')).toBe('/')
    expect(normalizeWebPath('//')).toBe('/')
  })

  it('prepends a missing leading slash', () => {
    expect(normalizeWebPath('foo')).toBe('/foo')
  })

  it('strips trailing slashes', () => {
    expect(normalizeWebPath('/foo/')).toBe('/foo')
    expect(normalizeWebPath('/foo///')).toBe('/foo')
  })
})

describe('toSocketPath', () => {
  it('maps the root web path to the default socket path', () => {
    expect(toSocketPath('/')).toBe('/socket.io')
  })

  it('follows a non-root web path', () => {
    expect(toSocketPath('/foo')).toBe('/foo/socket.io')
  })
})

describe('resolveOptions', () => {
  it('applies the v2 defaults', () => {
    expect(resolveOptions({})).toEqual({
      port: DEFAULT_PORT,
      host: DEFAULT_HOST,
      webPath: '/',
      socketPath: '/socket.io',
      startOnLoad: true,
      windowUpdateDebounceTime: DEFAULT_DEBOUNCE_TIME,
    })
  })

  it('treats startOnLoad: false as disabled and anything else as enabled', () => {
    expect(resolveOptions({ startOnLoad: false }).startOnLoad).toBe(false)
    expect(resolveOptions({ startOnLoad: true }).startOnLoad).toBe(true)
  })

  it('accepts the legacy path alias', () => {
    expect(resolveOptions({ path: 'foo' }).webPath).toBe('/foo')
  })

  it('prefers windowUpdateDebounceTime over the debounceTime alias', () => {
    expect(
      resolveOptions({ windowUpdateDebounceTime: 5, debounceTime: 50 }).windowUpdateDebounceTime,
    ).toBe(5)
  })

  it('falls back to the debounceTime alias', () => {
    expect(resolveOptions({ debounceTime: 50 }).windowUpdateDebounceTime).toBe(50)
  })

  it('freezes the resolved options', () => {
    expect(Object.isFrozen(resolveOptions({}))).toBe(true)
  })
})
