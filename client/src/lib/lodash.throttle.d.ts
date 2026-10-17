declare module 'lodash.throttle' {
  interface ThrottledFunction {
    (): void
    cancel(): void
    flush(): void
  }

  /** The subset of lodash.throttle this package uses. */
  function throttle(callback: () => void, waitMs?: number): ThrottledFunction

  export = throttle
}
