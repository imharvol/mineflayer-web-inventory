import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    compat: 'src/compat.ts',
  },
  format: ['esm', 'cjs'],
  platform: 'node',
  target: 'node22',
  dts: { cjsDefault: true },
  clean: true,
  shims: true,
  sourcemap: true,
  alias: {
    '@shared': new URL('./shared', import.meta.url).pathname,
  },
  deps: {
    // Type-only imports from these stay references in the published d.ts
    // instead of inlining their (unsupported) declaration graphs.
    neverBundle: ['mineflayer', 'prismarine-item'],
  },
  plugins: [
    {
      // The CJS types declare a default export (alongside named type exports),
      // so the runtime has to expose one too; `require()` still returns the
      // plugin function itself, matching the v1 contract.
      name: 'cjs-default-interop',
      generateBundle(_options, bundle) {
        for (const [fileName, chunk] of Object.entries(bundle)) {
          if (fileName.endsWith('index.cjs') && chunk.type === 'chunk') {
            chunk.code += '\nmodule.exports.default = module.exports\n'
          }
        }
      },
    },
  ],
})
