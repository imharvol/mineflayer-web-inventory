import { describe, expect, it } from 'vitest'
import { findSlotAt, type SlotCoordinates } from './hitTest'

const coordinates: SlotCoordinates = {
  0: [8, 6],
  1: [44, 6],
}

describe('findSlotAt', () => {
  it('finds the slot whose rect contains the point', () => {
    expect(findSlotAt(coordinates, 10, 10)).toBe(0)
    expect(findSlotAt(coordinates, 46, 10)).toBe(1)
  })

  it('treats the top-left corner as inside and the far edges as outside', () => {
    expect(findSlotAt(coordinates, 8, 6)).toBe(0)
    expect(findSlotAt(coordinates, 39, 37)).toBe(0)
    expect(findSlotAt(coordinates, 40, 37)).toBeNull()
    expect(findSlotAt(coordinates, 8, 38)).toBeNull()
  })

  it('returns null for points in the gaps and for missing coordinates', () => {
    expect(findSlotAt(coordinates, 41, 10)).toBeNull()
    expect(findSlotAt(coordinates, 100, 100)).toBeNull()
    expect(findSlotAt(undefined, 10, 10)).toBeNull()
  })
})
