import { ITEM_SIZE, type SlotPosition } from '@shared/draw'

export type SlotCoordinates = Record<number, SlotPosition>

/** The slot whose item rect contains the canvas point, if any. */
export function findSlotAt(
  coordinates: SlotCoordinates | undefined,
  x: number,
  y: number,
): number | null {
  if (!coordinates) return null

  for (const key in coordinates) {
    const slot = Number(key)
    const position = coordinates[slot]
    if (!position) continue
    const [slotX, slotY] = position
    if (x >= slotX && x < slotX + ITEM_SIZE && y >= slotY && y < slotY + ITEM_SIZE) {
      return slot
    }
  }
  return null
}
