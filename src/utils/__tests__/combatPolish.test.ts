import { describe, it, expect } from 'vitest'
import { statLabel } from '@/engine/statDisplay'
import { itemStatSummary } from '@/utils/icons'
import { getItemTemplate } from '@/engine/ItemDatabase'

describe('combat polish display', () => {
  it('shows strength stat as Strength', () => {
    expect(statLabel('strength')).toBe('Strength')
  })

  it('renders wooden stake boost as on-use percent, not flat boost damage', () => {
    const stake = getItemTemplate('wooden_stake')
    expect(itemStatSummary(stake)).toBe('On use: +50% next attack')
  })
})
