import type { SlotIndex, WindowMessage, WindowUpdateMessage, WireSlots } from '@shared/messages'
import type { Item } from 'prismarine-item'
import { createDebouncer } from './debounce'
import { type ItemPresenter, readItemDurability, toItemView } from './items'
import { log } from './logger'
import {
  getWindowKind,
  type InventoryParts,
  PLAYER_PREFIX_SLOTS,
  toInventorySlot,
  toInventorySlots,
} from './windows'

export type UpdateSlotListener = (
  slot: SlotIndex,
  oldItem: Item | null,
  newItem: Item | null,
) => void

export interface TrackerWindow extends InventoryParts {
  type: string | number
  on(event: 'updateSlot', listener: UpdateSlotListener): unknown
  removeListener(event: 'updateSlot', listener: UpdateSlotListener): unknown
}

export interface TrackerBot {
  /** Undefined until mineflayer injects its internal plugins. */
  inventory: TrackerWindow | undefined
  currentWindow: TrackerWindow | null
  on(event: 'windowOpen', listener: (window: TrackerWindow) => void): unknown
  // Unlike the per-window 'close' event, 'windowClose' also fires when the
  // server closes a window (death, respawn), which v1 missed.
  on(event: 'windowClose', listener: (window: TrackerWindow) => void): unknown
  /** Emitted by mineflayer once after its internal plugins are injected. */
  once(event: 'inject_allowed', listener: () => void): unknown
  removeListener(event: 'windowOpen', listener: (window: TrackerWindow) => void): unknown
  removeListener(event: 'windowClose', listener: (window: TrackerWindow) => void): unknown
  removeListener(event: 'inject_allowed', listener: () => void): unknown
}

export type TrackerMessage =
  | { kind: 'window'; message: WindowMessage }
  | { kind: 'update'; message: WindowUpdateMessage }

export interface WindowTracker {
  /** Latest full window; rebuilt from live bot state, safe to read at any time. */
  readonly current: WindowMessage
  subscribe(listener: (message: TrackerMessage) => void): () => void
  dispose(): void
}

export function createWindowTracker(
  bot: TrackerBot,
  presenter: ItemPresenter,
  debounceMs: number,
): WindowTracker {
  const subscribers = new Set<(message: TrackerMessage) => void>()
  let pending = emptyUpdate()
  let trackedWindow: TrackerWindow | null = null
  let trackedUpdateHandler: UpdateSlotListener | null = null
  let attachedInventory: TrackerWindow | null = null

  const debouncer = createDebouncer(flush, debounceMs)

  function emptyUpdate(): WindowUpdateMessage {
    return { id: -1, type: 'inventory', slots: {} }
  }

  /** Shown to sockets that connect before mineflayer's plugins are injected. */
  function emptyInventoryMessage(): WindowMessage {
    return { id: 0, type: 'inventory', slots: {} }
  }

  function emit(message: TrackerMessage): void {
    for (const listener of subscribers) {
      try {
        listener(message)
      } catch (error) {
        log.warn('A window message listener failed', error)
      }
    }
  }

  function presentSlots(slots: ReadonlyArray<Item | null>): WireSlots {
    const wire: WireSlots = {}
    for (let index = 0; index < slots.length; index++) {
      const item = slots[index]
      wire[index] = item ? presenter.present(item) : null
    }
    return wire
  }

  function translatedSlots(window: TrackerWindow): WireSlots {
    const wire: WireSlots = {}
    const copies = toInventorySlots(window)
    for (let index = 0; index < copies.length; index++) {
      const copy = copies[index]
      if (!copy) {
        wire[index] = null
        continue
      }
      // Displays in player-inventory coordinates; durability is read from the
      // source item (v1 shape) and rides along additively on the wire.
      const sourceIndex = window.inventoryStart + index - PLAYER_PREFIX_SLOTS
      wire[index] = presenter.present(copy, readItemDurability(window.slots[sourceIndex]))
    }
    return wire
  }

  function windowMessageFor(window: TrackerWindow): WindowMessage {
    const kind = getWindowKind(window.type, window.slots.length)
    if (kind) {
      return { id: window.id, type: kind, slots: presentSlots(window.slots) }
    }

    const inventory = bot.inventory
    if (!inventory) return emptyInventoryMessage()

    return {
      id: inventory.id,
      type: getWindowKind(inventory.type, inventory.slots.length) ?? 'inventory',
      slots: translatedSlots(window),
      unsupported: true,
      realId: window.id,
      realType: String(window.type),
    }
  }

  function queueUpdate(window: TrackerWindow, slot: SlotIndex, newItem: Item | null): void {
    const kind = getWindowKind(window.type, window.slots.length)

    if (kind === null) {
      // Unsupported windows are shown as player-inventory updates (v1 behavior).
      const inventory = bot.inventory
      if (!inventory) return

      const inventoryKind = getWindowKind(inventory.type, inventory.slots.length) ?? 'inventory'
      if (pending.id !== inventory.id)
        pending = { id: inventory.id, type: inventoryKind, slots: {} }

      const translatedSlot = toInventorySlot(slot, window)
      const durabilityUsed = readItemDurability(window.slots[slot])
      pending.slots[translatedSlot] = newItem
        ? presenter.present(toItemView(newItem, { slot: translatedSlot }), durabilityUsed)
        : null
      debouncer.schedule()
      return
    }

    // Updates from a window that is not the active one are ignored.
    const active = bot.currentWindow
    if (active && window.id !== active.id) return

    if (pending.id !== window.id) pending = { id: window.id, type: kind, slots: {} }

    const durabilityUsed = readItemDurability(window.slots[slot])
    pending.slots[slot] = newItem ? presenter.present(newItem, durabilityUsed) : null
    debouncer.schedule()
  }

  function flush(): void {
    if (Object.keys(pending.slots).length === 0) return
    emit({ kind: 'update', message: pending })
    pending = emptyUpdate()
  }

  function clearPending(): void {
    debouncer.cancel()
    pending = emptyUpdate()
  }

  function attachWindow(window: TrackerWindow): void {
    if (trackedWindow === window) return
    detachWindow()

    trackedWindow = window
    trackedUpdateHandler = (slot, _oldItem, newItem) => safeQueueUpdate(window, slot, newItem)
    window.on('updateSlot', trackedUpdateHandler)
  }

  function detachWindow(): void {
    if (!trackedWindow) return
    if (trackedUpdateHandler) trackedWindow.removeListener('updateSlot', trackedUpdateHandler)
    trackedWindow = null
    trackedUpdateHandler = null
  }

  function safeQueueUpdate(window: TrackerWindow, slot: SlotIndex, newItem: Item | null): void {
    try {
      queueUpdate(window, slot, newItem)
    } catch (error) {
      log.warn(`Unable to process an update for slot ${slot}`, error)
    }
  }

  const inventoryUpdateHandler: UpdateSlotListener = (slot, _oldItem, newItem) => {
    if (bot.inventory) safeQueueUpdate(bot.inventory, slot, newItem)
  }

  function attachToInventory(): void {
    const inventory = bot.inventory
    if (!inventory || attachedInventory === inventory) return

    detachFromInventory()
    attachedInventory = inventory
    inventory.on('updateSlot', inventoryUpdateHandler)
    emit({ kind: 'window', message: windowMessageFor(inventory) })
  }

  function detachFromInventory(): void {
    if (!attachedInventory) return
    attachedInventory.removeListener('updateSlot', inventoryUpdateHandler)
    attachedInventory = null
  }

  function handleInjectAllowed(): void {
    try {
      attachToInventory()
    } catch (error) {
      log.warn('Unable to attach the inventory viewer after plugin injection', error)
    }
  }

  function handleWindowOpen(window: TrackerWindow): void {
    try {
      attachWindow(window)
      clearPending()
      emit({ kind: 'window', message: windowMessageFor(window) })
    } catch (error) {
      log.warn('Unable to open a window in the inventory viewer', error)
    }
  }

  function handleWindowClose(window: TrackerWindow): void {
    if (trackedWindow !== window) return
    try {
      detachWindow()
      clearPending()
      const inventory = bot.inventory
      if (inventory) emit({ kind: 'window', message: windowMessageFor(inventory) })
    } catch (error) {
      log.warn('Unable to close a window in the inventory viewer', error)
    }
  }

  function subscribe(listener: (message: TrackerMessage) => void): () => void {
    subscribers.add(listener)
    return () => {
      subscribers.delete(listener)
    }
  }

  function dispose(): void {
    detachWindow()
    detachFromInventory()
    bot.removeListener('inject_allowed', handleInjectAllowed)
    bot.removeListener('windowOpen', handleWindowOpen)
    bot.removeListener('windowClose', handleWindowClose)
    clearPending()
    subscribers.clear()
  }

  bot.on('windowOpen', handleWindowOpen)
  bot.on('windowClose', handleWindowClose)
  bot.once('inject_allowed', handleInjectAllowed)
  // When plugins are already injected (tests, late loads) there is no event left to wait for.
  attachToInventory()

  return {
    get current(): WindowMessage {
      const active = bot.currentWindow ?? bot.inventory
      return active ? windowMessageFor(active) : emptyInventoryMessage()
    },
    subscribe,
    dispose,
  }
}
