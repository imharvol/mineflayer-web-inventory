import type { Item } from 'prismarine-item'

type ItemFields = Omit<Partial<Item>, 'durabilityUsed'> & {
  name: string
  durabilityUsed?: number | null
}

/** Test double for the prismarine Item class; only the fields this package reads. */
export function makeItem(fields: ItemFields): Item {
  const item = {
    slot: 0,
    count: 1,
    metadata: 0,
    type: 0,
    nbt: null,
    stackId: null,
    displayName: fields.name,
    stackSize: 64,
    maxDurability: 0,
    ...fields,
  }
  return item as Item
}
