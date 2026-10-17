import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, type Page, test } from '@playwright/test'
import { getFreePort } from '../integration/free-port'

const harnessPath = fileURLToPath(new URL('./harness.ts', import.meta.url))
const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

let harness: ChildProcessWithoutNullStreams
let port: number

function send(line: string): void {
  harness.stdin.write(`${line}\n`)
}

async function waitForLine(stream: NodeJS.ReadableStream, match: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`timed out waiting for "${match}"`)), 20_000)
    const onData = (chunk: Buffer) => {
      if (chunk.toString().includes(match)) {
        clearTimeout(timeout)
        stream.off('data', onData)
        resolve()
      }
    }
    stream.on('data', onData)
  })
}

async function canvasHasPixels(page: Page): Promise<boolean> {
  // Evaluated in the browser; kept as a string so the root tsconfig stays Node-only.
  const result = await page.evaluate(`(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return false
    const context = canvas.getContext('2d')
    if (!context) return false
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    let opaque = 0
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] > 0) opaque++
    }
    return opaque > 1000
  })()`)
  return result === true
}

test.beforeAll(async () => {
  port = await getFreePort()
  harness = spawn(process.execPath, ['--import', 'tsx', harnessPath], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  await waitForLine(harness.stdout, 'listening')
})

test.afterAll(() => {
  send('quit')
  harness?.kill()
})

test('renders the live inventory and reacts to server updates', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${port}/`)

  await expect(page.locator('canvas#windowCanvas')).toBeVisible()
  await expect(page.getByText('Current Window Id: 0')).toBeVisible()
  await expect(page.getByText('Current Window Type: inventory')).toBeVisible()
  await expect(page.getByText('Dirt: 16')).toBeVisible()

  await expect.poll(() => canvasHasPixels(page)).toBe(true)

  send('update 37 pumpkin 32')
  await expect(page.getByText('Pumpkin: 32')).toBeVisible()

  send('update 36 diamond 5')
  await expect(page.getByText('Diamond: 5')).toBeVisible()
  await expect(page.getByText('Dirt: 16')).not.toBeVisible()

  send('clear 37')
  await expect(page.getByText('Pumpkin: 32')).not.toBeVisible()
})
