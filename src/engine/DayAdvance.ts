/**
 * Day advancement — craft delivery + economy tick.
 */

import type { GameState } from './GameLoopDesign'
import { processCraftOrders } from './CraftOrderSystem'
import { tickEconomy } from './EconomyTick'

export function advanceDay(state: GameState): GameState {
  const newDay = (state.day ?? 1) + 1
  let result: GameState = { ...state, day: newDay }
  result = processCraftOrders(result, newDay)
  result = tickEconomy(result)
  return result
}
