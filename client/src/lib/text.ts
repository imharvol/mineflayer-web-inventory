import type { ItemView } from '@shared/messages'

const FORMATTING_CODES = /§[0-9a-fk-orx]/gi

/** Strips the legacy § formatting codes Minecraft leaves in renamed items. */
export function stripFormattingCodes(text: string): string {
  return text.replace(FORMATTING_CODES, '')
}

/** The name shown for an item: its anvil name when it has one, its data name otherwise. */
export function itemLabel(item: Pick<ItemView, 'customName' | 'displayName'>): string {
  return stripFormattingCodes(item.customName ?? item.displayName)
}
