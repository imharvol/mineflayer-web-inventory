import throttle from 'lodash.throttle'

export interface Throttle {
  (): void
  cancel(): void
  flush(): void
}

/** Leading + trailing throttle, matching the v1 client behavior. */
export function createThrottle(callback: () => void, delayMs: number): Throttle {
  return throttle(callback, delayMs)
}
