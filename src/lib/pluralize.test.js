import { describe, it, expect } from 'vitest'
import { pluralize } from './pluralize'

describe('pluralize', () => {
  it('returns singular for count of 1', () => {
    expect(pluralize(1, 'screen')).toBe('screen')
  })

  it('returns default plural for count !== 1', () => {
    expect(pluralize(0, 'screen')).toBe('screens')
    expect(pluralize(2, 'screen')).toBe('screens')
  })

  it('supports an irregular plural override', () => {
    expect(pluralize(2, 'city', 'cities')).toBe('cities')
    expect(pluralize(1, 'city', 'cities')).toBe('city')
  })
})
