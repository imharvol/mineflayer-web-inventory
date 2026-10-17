import { describe, expect, it } from 'vitest'
import { itemLabel, stripFormattingCodes } from './text'

describe('stripFormattingCodes', () => {
  it('removes legacy color and style codes', () => {
    expect(stripFormattingCodes('§aExcalibur')).toBe('Excalibur')
    expect(stripFormattingCodes('§l§nBold')).toBe('Bold')
  })

  it('removes hex color sequences', () => {
    expect(stripFormattingCodes('§x§f§f§0§0§0§0Red')).toBe('Red')
  })

  it('leaves plain text untouched', () => {
    expect(stripFormattingCodes('Excalibur')).toBe('Excalibur')
  })
})

describe('itemLabel', () => {
  it('prefers the custom name over the data name', () => {
    expect(itemLabel({ displayName: 'Diamond Sword', customName: 'Excalibur' })).toBe('Excalibur')
  })

  it('falls back to the data name', () => {
    expect(itemLabel({ displayName: 'Diamond Sword' })).toBe('Diamond Sword')
  })

  it('strips formatting codes from the custom name', () => {
    expect(itemLabel({ displayName: 'Diamond Sword', customName: '§6Legendary' })).toBe('Legendary')
  })
})
