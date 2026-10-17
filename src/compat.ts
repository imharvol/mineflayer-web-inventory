import type { ItemView, SlotIndex, WindowKind } from '@shared/messages'
import type { Item } from 'prismarine-item'
import { loadBlockModels, type McAssets, type McData } from './assets'
import { createItemPresenter, type ItemPresenter } from './items'
import { getWindowKind } from './windows'

/** v1 shape: the whole window object, not (type, slotCount). */
export interface LegacyWindow {
  type: string | number
  slots: Record<SlotIndex, unknown>
}

export function getWindowName(window: LegacyWindow): WindowKind | null {
  return getWindowKind(window.type, Object.keys(window.slots).length)
}

// One presenter per (data, assets) pair, so block models are loaded at most
// once per assets instance instead of on every call (what v1 did).
const presenters = new WeakMap<McAssets, WeakMap<McData, ItemPresenter>>()

/** v1 shape: callers pass their own minecraft-data / minecraft-assets instances. */
export function addItemData(data: McData, assets: McAssets, item: Item): ItemView {
  return getPresenter(data, assets).present(item)
}

function getPresenter(data: McData, assets: McAssets): ItemPresenter {
  let byAssets = presenters.get(assets)
  if (!byAssets) {
    byAssets = new WeakMap()
    presenters.set(assets, byAssets)
  }

  let presenter = byAssets.get(data)
  if (!presenter) {
    presenter = createItemPresenter({
      data,
      assets,
      blockModels: loadBlockModels(assets.directory),
    })
    byAssets.set(data, presenter)
  }
  return presenter
}
