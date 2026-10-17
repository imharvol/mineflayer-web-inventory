import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDebouncer } from './debounce'

describe('createDebouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs the callback once after the delay', () => {
    const callback = vi.fn()
    const debouncer = createDebouncer(callback, 100)

    debouncer.schedule()
    vi.advanceTimersByTime(99)
    expect(callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('coalesces repeated schedules into a single run', () => {
    const callback = vi.fn()
    const debouncer = createDebouncer(callback, 100)

    debouncer.schedule()
    vi.advanceTimersByTime(50)
    debouncer.schedule()
    vi.advanceTimersByTime(50)
    expect(callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(50)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('cancel prevents a scheduled run and clears pending', () => {
    const callback = vi.fn()
    const debouncer = createDebouncer(callback, 100)

    debouncer.schedule()
    expect(debouncer.pending).toBe(true)
    debouncer.cancel()

    expect(debouncer.pending).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(callback).not.toHaveBeenCalled()
  })

  it('reports pending state while a run is scheduled', () => {
    const debouncer = createDebouncer(() => {}, 100)
    expect(debouncer.pending).toBe(false)

    debouncer.schedule()
    expect(debouncer.pending).toBe(true)

    vi.advanceTimersByTime(100)
    expect(debouncer.pending).toBe(false)
  })
})
