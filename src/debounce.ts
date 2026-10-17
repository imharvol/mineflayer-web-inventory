import debounce from 'lodash.debounce'

export interface Debouncer {
  schedule(): void
  cancel(): void
  readonly pending: boolean
}

/**
 * Thin wrapper over `lodash.debounce`: we own the interface, lodash owns the
 * timing edge cases. Never use the `lodash` monolith here — its advisories
 * target functions this package does not use.
 */
export function createDebouncer(callback: () => void, delayMs: number): Debouncer {
  let pending = false
  const debounced = debounce(() => {
    pending = false
    callback()
  }, delayMs)

  return {
    schedule(): void {
      pending = true
      debounced()
    },
    cancel(): void {
      pending = false
      debounced.cancel()
    },
    get pending(): boolean {
      return pending
    },
  }
}
