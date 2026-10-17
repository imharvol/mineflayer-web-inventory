import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const fixturesDir = fileURLToPath(new URL('./fixtures', import.meta.url))

interface PackResult {
  name: string
  version: string
  size: number
  files: Array<{ path: string }>
}

let consumerDir: string | null = null
let pack: PackResult

function run(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

describe('packed tarball consumer', () => {
  beforeAll(() => {
    run('npm', ['run', 'build'], repoRoot)

    const packDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-inventory-pack-'))
    const output = run(
      'npm',
      ['pack', '--ignore-scripts', '--json', '--pack-destination', packDir],
      repoRoot,
    )
    const parsed = JSON.parse(output) as Record<string, PackResult>
    const result = Object.values(parsed)[0]
    if (!result) throw new Error('npm pack returned no result')
    pack = result
    const tarball = path.join(packDir, `${result.name}-${result.version}.tgz`)

    consumerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-inventory-consumer-'))
    fs.writeFileSync(
      path.join(consumerDir, 'package.json'),
      JSON.stringify(
        {
          name: 'compat-consumer',
          version: '0.0.0',
          private: true,
          dependencies: {
            'mineflayer-web-inventory': `file:${tarball}`,
            mineflayer: '^4.39.0',
            'socket.io-client': '^4.8.4',
          },
          devDependencies: {
            typescript: '^7.0.2',
            '@types/node': '^22.18.0',
          },
        },
        null,
        2,
      ),
    )

    run('npm', ['install', '--no-audit', '--no-fund'], consumerDir)

    for (const fixture of fs.readdirSync(fixturesDir)) {
      fs.copyFileSync(path.join(fixturesDir, fixture), path.join(consumerDir, fixture))
    }
  }, 600_000)

  afterAll(() => {
    if (consumerDir) fs.rmSync(consumerDir, { recursive: true, force: true })
  })

  it('packs only the published files', () => {
    const files = pack.files.map((file) => file.path)

    expect(files).toContain('dist/index.cjs')
    expect(files).toContain('dist/index.mjs')
    expect(files).toContain('dist/index.d.cts')
    expect(files).toContain('dist/index.d.mts')
    expect(files).toContain('dist/compat.cjs')
    expect(files).toContain('dist/compat.mjs')
    expect(files.some((file) => file.startsWith('client/dist/'))).toBe(true)
    expect(files.some((file) => file.startsWith('client/src/'))).toBe(false)
    expect(files.some((file) => file.startsWith('src/'))).toBe(false)
    expect(files.filter((file) => file.endsWith('.md'))).toEqual(['README.md'])
  })

  it('require() returns the plugin function and the wire format is frozen', () => {
    const output = run(process.execPath, ['cjs-consumer.cjs'], consumerDir as string)
    expect(output).toContain('CJS OK')
  })

  it('import default is the same plugin', () => {
    const output = run(process.execPath, ['esm-consumer.mjs'], consumerDir as string)
    expect(output).toContain('ESM OK')
  })

  it('type-checks a consumer with moduleResolution node16', () => {
    run(
      path.join(consumerDir as string, 'node_modules', '.bin', 'tsc'),
      ['-p', 'tsconfig.node16.json'],
      consumerDir as string,
    )
  })

  it('type-checks a consumer with moduleResolution bundler', () => {
    run(
      path.join(consumerDir as string, 'node_modules', '.bin', 'tsc'),
      ['-p', 'tsconfig.bundler.json'],
      consumerDir as string,
    )
  })
})
