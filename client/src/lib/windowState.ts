import type { WindowMessage, WindowUpdateMessage, WireSlots } from '@shared/messages'

/** Snapshots replace the state; the old state parameter is kept for signature parity. */
export function applyWindow(
  state: WindowMessage | undefined,
  message: WindowMessage,
): WindowMessage {
  void state
  return message
}

/** Merges slot updates into the current window; updates for other windows are dropped. */
export function applyUpdate(state: WindowMessage, update: WindowUpdateMessage): WindowMessage {
  if (update.id !== state.id) return state

  const slots: WireSlots = { ...state.slots }
  for (const key in update.slots) {
    const slot = update.slots[key]
    if (slot !== undefined) slots[key] = slot
  }
  return { ...state, slots }
}
