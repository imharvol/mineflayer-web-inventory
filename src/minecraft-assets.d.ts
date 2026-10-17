declare module 'minecraft-assets' {
  import type { McAssets } from './assets'

  const loadAssets: (version?: string) => McAssets | null
  export default loadAssets
}
