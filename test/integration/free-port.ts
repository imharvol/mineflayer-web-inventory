import { createServer } from 'node:net'

/** Reserves a free localhost port for tests that need a fixed listen target. */
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to determine a free port'))
        return
      }
      const { port } = address
      probe.close(() => resolve(port))
    })
  })
}
