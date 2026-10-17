export type SlotIndex = number

export type WindowKind = 'inventory' | 'chest' | 'large-chest' | 'crafting-table' | 'furnace'

/**
 * A slot-sized view of an item. v1 sent through every enumerable field of the
 * prismarine Item (metadata, nbt, …), not just the ones below — the passthrough
 * index signature is part of the compatibility contract, not laziness.
 */
export interface ItemView {
  slot: SlotIndex
  name: string
  displayName: string
  count: number
  texture?: string
  durabilityUsed?: number | null
  durabilityLeft?: number
  [passthrough: string]: unknown
}

export type WireSlots = Record<SlotIndex, ItemView | null>

export interface WindowMessage {
  id: number
  type: WindowKind
  slots: WireSlots
  unsupported?: boolean
  realId?: number
  realType?: string
}

export interface WindowUpdateMessage {
  id: number
  type: WindowKind
  slots: WireSlots
}

export interface ServerToClientEvents {
  window: (message: WindowMessage) => void
  windowUpdate: (message: WindowUpdateMessage) => void
}

export interface ClientToServerEvents {
  [event: string]: (...args: never[]) => void
}
