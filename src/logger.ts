const PREFIX = '(mineflayer-web-inventory)'

export const log = {
  info(message: string): void {
    console.log(`${PREFIX} INFO: ${message}`)
  },
  warn(message: string, error?: unknown): void {
    console.log(`${PREFIX} WARNING: ${message}`)
    if (error !== undefined) console.log(error)
  },
  error(message: string, error?: unknown): void {
    console.log(`${PREFIX} ERROR: ${message}`)
    if (error !== undefined) console.log(error)
  },
}
