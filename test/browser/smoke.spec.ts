import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import fs from 'node:fs'
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

test('shows custom (anvil) names in the item list and as a hover tooltip', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${port}/`)
  await expect(page.getByText('Current Window Id: 0')).toBeVisible()

  send('custom 38 diamond_sword 5 Excalibur')

  await expect(page.getByText('Excalibur: 5')).toBeVisible()
  await expect(page.getByText('Diamond_sword: 5')).not.toBeVisible()

  const canvas = page.locator('canvas#windowCanvas')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('canvas has no bounding box')

  const response = await fetch(`http://127.0.0.1:${port}/windows/coordinates.json`)
  const coordinates = (await response.json()) as Record<string, Record<string, [number, number]>>
  const position = coordinates.inventory?.['38']
  if (!position) throw new Error('missing slot coordinates for slot 38')

  await page.mouse.move(box.x + position[0] + 16, box.y + position[1] + 16)
  await expect(page.locator('.slot-tooltip')).toHaveText('Excalibur ×5')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 20)
  await expect(page.locator('.slot-tooltip')).toHaveCount(0)
})

test('downloads the canvas as a PNG', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${port}/`)
  await expect.poll(() => canvasHasPixels(page)).toBe(true)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download PNG' }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toBe('inventory.png')
  const filePath = await download.path()
  if (!filePath) throw new Error('the download has no file path')
  expect(fs.readFileSync(filePath).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
})
