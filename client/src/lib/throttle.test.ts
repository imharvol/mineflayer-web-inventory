import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createThrottle } from './throttle'

describe('createThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('invokes immediately on the leading edge', () => {
    const callback = vi.fn()
    const throttled = createThrottle(callback, 100)

    throttled()
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('coalesces rapid calls and runs once more on the trailing edge', () => {
    const callback = vi.fn()
    const throttled = createThrottle(callback, 100)

    throttled()
    vi.advanceTimersByTime(10)
    throttled()
    vi.advanceTimersByTime(10)
    throttled()
    expect(callback).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(100)
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('cancel drops the pending trailing call', () => {
    const callback = vi.fn()
    const throttled = createThrottle(callback, 100)

    throttled()
    vi.advanceTimersByTime(10)
    throttled()
    throttled.cancel()

    vi.advanceTimersByTime(500)
    expect(callback).toHaveBeenCalledTimes(1)
  })
})
