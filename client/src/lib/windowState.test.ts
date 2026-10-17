import type { ItemView, WindowMessage, WindowUpdateMessage } from '@shared/messages'
import { describe, expect, it } from 'vitest'
import { applyUpdate, applyWindow } from './windowState'

function item(name: string, slot: number): ItemView {
  return { name, slot, displayName: name, count: 1 }
}

function makeWindow(overrides: Partial<WindowMessage> = {}): WindowMessage {
  return { id: 0, type: 'inventory', slots: {}, ...overrides }
}

describe('applyWindow', () => {
  it('replaces the previous state with the snapshot', () => {
    const previous = makeWindow({ id: 1, type: 'chest' })
    const message = makeWindow({ id: 2, type: 'furnace' })

    expect(applyWindow(previous, message)).toBe(message)
  })
})

describe('applyUpdate', () => {
  it('merges slots into the current window', () => {
    const state = makeWindow({ slots: { 36: item('dirt', 36), 37: null } })
    const update: WindowUpdateMessage = {
      id: 0,
      type: 'inventory',
      slots: { 36: item('melon', 36) },
    }

    const merged = applyUpdate(state, update)

    expect(merged.slots[36]?.name).toBe('melon')
    expect(merged.slots[37]).toBeNull()
  })

  it('ignores updates for a different window', () => {
    const state = makeWindow({ id: 0 })
    const update: WindowUpdateMessage = { id: 2, type: 'chest', slots: { 0: item('dirt', 0) } }

    expect(applyUpdate(state, update)).toBe(state)
  })

  it('clears slots with null updates', () => {
    const state = makeWindow({ slots: { 36: item('dirt', 36) } })

    const merged = applyUpdate(state, { id: 0, type: 'inventory', slots: { 36: null } })

    expect(merged.slots[36]).toBeNull()
  })

  it('returns a new object and never mutates the state', () => {
    const state = makeWindow({ slots: { 36: item('dirt', 36) } })

    const merged = applyUpdate(state, { id: 0, type: 'inventory', slots: { 36: null } })

    expect(merged).not.toBe(state)
    expect(state.slots[36]?.name).toBe('dirt')
  })
})
