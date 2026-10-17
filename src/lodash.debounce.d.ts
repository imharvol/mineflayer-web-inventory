declare module 'lodash.debounce' {
  interface DebouncedFunction {
    (): void
    cancel(): void
    flush(): void
  }

  /** The subset of lodash.debounce this package uses. */
  function debounce(callback: () => void, waitMs?: number): DebouncedFunction

  export = debounce
}
