import type { ItemView, WindowMessage, WindowUpdateMessage } from '@shared/messages'
import type { Item } from 'prismarine-item'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeItem, withCustomName } from '../test/fixtures/items'
import { createChestWindow, createHopperWindow, FakeBot } from '../test/integration/fake-bot'
import type { ItemPresenter } from './items'
import { createWindowTracker, type TrackerMessage, type WindowTracker } from './tracker'

interface PresentCall {
  name: string
  durabilityUsed?: number | null
  customName?: unknown
}

function createRecordingPresenter(): ItemPresenter & { calls: PresentCall[] } {
  const calls: PresentCall[] = []
  return {
    calls,
    present(item: Item | ItemView, durabilityUsed?: number | null): ItemView {
      calls.push({ name: item.name, durabilityUsed, customName: item.customName })
      const view: ItemView = { ...item, displayName: `web:${item.name}` }
      if (durabilityUsed !== undefined) view.durabilityUsed = durabilityUsed
      return view
    },
  }
}

function asUpdate(message: TrackerMessage | undefined): WindowUpdateMessage {
  if (message?.kind !== 'update') throw new Error('expected an update message')
  return message.message
}

function asWindow(message: TrackerMessage | undefined): WindowMessage {
  if (message?.kind !== 'window') throw new Error('expected a window message')
  return message.message
}

describe('createWindowTracker', () => {
  let bot: FakeBot
  let presenter: ReturnType<typeof createRecordingPresenter>
  let tracker: WindowTracker
  let messages: TrackerMessage[]

  beforeEach(() => {
    vi.useFakeTimers()
    bot = new FakeBot()
    presenter = createRecordingPresenter()
    tracker = createWindowTracker(bot, presenter, 100)
    messages = []
    tracker.subscribe((message) => messages.push(message))
  })

  afterEach(() => {
    tracker.dispose()
    vi.useRealTimers()
  })

  it('builds the current snapshot from live bot state', () => {
    bot.inventory.updateSlot(36, makeItem({ name: 'dirt', count: 16 }))

    const current = tracker.current
    expect(current.id).toBe(0)
    expect(current.type).toBe('inventory')
    expect(current.slots[36]?.name).toBe('dirt')
    expect(current.slots[36]?.displayName).toBe('web:dirt')
    expect(current.slots[0]).toBeNull()
    expect(Object.keys(current.slots)).toHaveLength(46)
  })

  it('emits one debounced update carrying every queued slot', () => {
    bot.inventory.updateSlot(36, makeItem({ name: 'dirt', count: 16 }))
    bot.inventory.updateSlot(37, makeItem({ name: 'melon' }))

    vi.advanceTimersByTime(99)
    expect(messages).toHaveLength(0)

    vi.advanceTimersByTime(1)
    expect(messages).toHaveLength(1)
    const update = asUpdate(messages[0])
    expect(update.id).toBe(0)
    expect(update.type).toBe('inventory')
    expect(update.slots[36]?.displayName).toBe('web:dirt')
    expect(update.slots[37]?.name).toBe('melon')
  })

  it('keeps only the last write per slot', () => {
    bot.inventory.updateSlot(36, makeItem({ name: 'dirt' }))
    bot.inventory.updateSlot(36, makeItem({ name: 'melon' }))

    vi.advanceTimersByTime(100)
    expect(asUpdate(messages[0]).slots[36]?.name).toBe('melon')
  })

  it('transmits emptied slots as null', () => {
    bot.inventory.updateSlot(36, makeItem({ name: 'dirt' }))
    vi.advanceTimersByTime(100)
    messages.length = 0

    bot.inventory.updateSlot(36, null)
    vi.advanceTimersByTime(100)
    expect(asUpdate(messages[0]).slots[36]).toBeNull()
  })

  it('reads durability from the window slot at event time', () => {
    bot.inventory.updateSlot(36, makeItem({ name: 'golden_pickaxe', durabilityUsed: 5 }))

    expect(presenter.calls.at(-1)).toEqual({ name: 'golden_pickaxe', durabilityUsed: 5 })
  })

  it('ignores inventory updates while another window is open', () => {
    const chest = createChestWindow(2)
    bot.openWindow(chest)
    messages.length = 0

    bot.inventory.updateSlot(36, makeItem({ name: 'dirt' }))
    vi.advanceTimersByTime(500)

    expect(messages).toHaveLength(0)
  })

  it('emits a snapshot on window open and drops updates queued for the previous window', () => {
    bot.inventory.updateSlot(36, makeItem({ name: 'dirt' }))
    const chest = createChestWindow(2)
    bot.openWindow(chest)

    expect(messages).toHaveLength(1)
    const snapshot = asWindow(messages[0])
    expect(snapshot.id).toBe(2)
    expect(snapshot.type).toBe('chest')
    expect(Object.keys(snapshot.slots)).toHaveLength(63)
    expect(snapshot.slots[0]).toBeNull()

    vi.advanceTimersByTime(500)
    expect(messages).toHaveLength(1)
  })

  it('emits updates from the open window in its own coordinates', () => {
    const chest = createChestWindow(2)
    bot.openWindow(chest)
    messages.length = 0

    chest.updateSlot(0, makeItem({ name: 'dirt', count: 16 }))
    vi.advanceTimersByTime(100)

    const update = asUpdate(messages[0])
    expect(update.id).toBe(2)
    expect(update.type).toBe('chest')
    expect(update.slots[0]?.name).toBe('dirt')
  })

  it('returns to the inventory snapshot when the open window closes', () => {
    const chest = createChestWindow(2)
    bot.openWindow(chest)
    messages.length = 0

    bot.closeWindow(chest)

    expect(messages).toHaveLength(1)
    const snapshot = asWindow(messages[0])
    expect(snapshot.id).toBe(0)
    expect(snapshot.type).toBe('inventory')
  })

  it('ignores close events for windows that are no longer tracked', () => {
    const first = createChestWindow(2)
    const second = createChestWindow(3)
    bot.openWindow(first)
    bot.openWindow(second)
    messages.length = 0

    bot.closeWindow(first)

    expect(messages).toHaveLength(0)
    expect(second.listenerCount('updateSlot')).toBe(1)
    expect(first.listenerCount('updateSlot')).toBe(0)
  })

  it('translates unsupported windows into inventory coordinates', () => {
    const hopper = createHopperWindow(3)
    bot.openWindow(hopper)

    const snapshot = asWindow(messages[0])
    expect(snapshot.unsupported).toBe(true)
    expect(snapshot.realId).toBe(3)
    expect(snapshot.realType).toBe('minecraft:hopper')
    expect(snapshot.id).toBe(0)
    expect(snapshot.type).toBe('inventory')
    expect(Object.keys(snapshot.slots)).toHaveLength(45)
  })

  it('translates updates from unsupported windows', () => {
    const hopper = createHopperWindow(3)
    bot.openWindow(hopper)
    messages.length = 0

    hopper.updateSlot(5, makeItem({ name: 'dirt', count: 16 }))
    vi.advanceTimersByTime(100)

    const update = asUpdate(messages[0])
    expect(update.id).toBe(0)
    expect(update.type).toBe('inventory')
    expect(update.slots[9]?.name).toBe('dirt')
    expect(update.slots[9]?.slot).toBe(9)
  })

  it('carries getter-backed custom names through unsupported-window updates', () => {
    const hopper = createHopperWindow(3)
    bot.openWindow(hopper)
    messages.length = 0

    hopper.updateSlot(5, withCustomName(makeItem({ name: 'dirt', count: 16 }), 'Excalibur'))
    vi.advanceTimersByTime(100)

    const update = asUpdate(messages[0])
    expect(update.slots[9]?.customName).toBe('Excalibur')
    expect(presenter.calls.at(-1)?.customName).toBe('Excalibur')
  })

  it('keeps listener counts stable across window open/close cycles', () => {
    expect(bot.inventory.listenerCount('updateSlot')).toBe(1)
    expect(bot.listenerCount('windowOpen')).toBe(1)
    expect(bot.listenerCount('windowClose')).toBe(1)
    expect(bot.listenerCount('inject_allowed')).toBe(1)

    for (let index = 0; index < 5; index++) {
      const chest = createChestWindow(10 + index)
      bot.openWindow(chest)
      expect(chest.listenerCount('updateSlot')).toBe(1)
      bot.closeWindow(chest)
      expect(chest.listenerCount('updateSlot')).toBe(0)
    }

    expect(bot.inventory.listenerCount('updateSlot')).toBe(1)
    expect(bot.listenerCount('windowOpen')).toBe(1)
    expect(bot.listenerCount('windowClose')).toBe(1)
  })

  it('stops emitting and detaches every listener on dispose', () => {
    tracker.dispose()

    expect(bot.inventory.listenerCount('updateSlot')).toBe(0)
    expect(bot.listenerCount('windowOpen')).toBe(0)
    expect(bot.listenerCount('windowClose')).toBe(0)
    expect(bot.listenerCount('inject_allowed')).toBe(0)

    bot.inventory.updateSlot(36, makeItem({ name: 'dirt' }))
    vi.advanceTimersByTime(500)
    expect(messages).toHaveLength(0)
  })

  it('attaches to the inventory when mineflayer injects its plugins', () => {
    const deferredBot = new FakeBot()
    ;(deferredBot as { inventory?: FakeBot['inventory'] }).inventory = undefined
    const deferredTracker = createWindowTracker(deferredBot, createRecordingPresenter(), 10)
    const received: TrackerMessage[] = []
    deferredTracker.subscribe((message) => received.push(message))

    expect(deferredTracker.current.slots).toEqual({})

    const inventory = new FakeBot().inventory
    ;(deferredBot as { inventory?: FakeBot['inventory'] }).inventory = inventory
    deferredBot.emit('inject_allowed')

    expect(inventory.listenerCount('updateSlot')).toBe(1)
    expect(received).toHaveLength(1)
    expect(received[0]?.kind).toBe('window')

    inventory.updateSlot(36, makeItem({ name: 'dirt' }))
    vi.advanceTimersByTime(10)
    expect(asUpdate(received[1]).slots[36]?.name).toBe('dirt')

    deferredTracker.dispose()
    expect(inventory.listenerCount('updateSlot')).toBe(0)
  })

  it('isolates failing subscribers from each other', () => {
    tracker.subscribe(() => {
      throw new Error('listener boom')
    })

    bot.inventory.updateSlot(36, makeItem({ name: 'dirt' }))
    vi.advanceTimersByTime(100)

    expect(messages).toHaveLength(1)
  })

  it('never throws out of a bot event when presentation fails', () => {
    const failingBot = new FakeBot()
    const failingPresenter: ItemPresenter = {
      present() {
        throw new Error('presentation boom')
      },
    }
    const failingTracker = createWindowTracker(failingBot, failingPresenter, 10)
    const received: TrackerMessage[] = []
    failingTracker.subscribe((message) => received.push(message))

    failingBot.inventory.updateSlot(1, makeItem({ name: 'dirt' }))
    vi.advanceTimersByTime(10)

    expect(received).toHaveLength(0)
    failingTracker.dispose()
  })
})
