/**
 * NPC craft orders — commission gear with a day-based queue.
 */

import type { GameState } from './GameLoopDesign'
import type { CraftOrder } from './ContentSchemas'
import { getBuildingLevel } from './BuildingSystem'
import { canCraft, getRecipe } from './CraftingSystem'
import { addItemToInventory, getItemName } from './ItemDatabase'
import { spendMaterials } from './Materials'

function orderId(): string {
  return `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

/** Items Garrick can finish per day; scales with workbench level. */
export function getCraftThroughput(state: GameState, npcId: string): number {
  if (npcId !== 'garrick_smith') return 1
  const level = getBuildingLevel(state, 'workbench')
  return level >= 2 ? 2 : level >= 1 ? 1 : 0
}

export function getCraftOrdersForNpc(state: GameState, npcId: string): CraftOrder[] {
  return (state.craftOrders ?? []).filter((o) => o.npcId === npcId)
}

export function getPendingCraftOrders(state: GameState, npcId?: string): CraftOrder[] {
  const day = state.day ?? 1
  const orders = state.craftOrders ?? []
  const pending = orders.filter((o) => o.readyOnDay > day)
  return npcId ? pending.filter((o) => o.npcId === npcId) : pending
}

function daysUntilReady(state: GameState, order: CraftOrder): number {
  return Math.max(0, order.readyOnDay - (state.day ?? 1))
}

export function describeCraftOrder(state: GameState, order: CraftOrder): string {
  const wait = daysUntilReady(state, order)
  const name = getItemName(order.itemId)
  if (wait <= 0) return `${name} — ready for pickup`
  return `${name} — ${wait} day${wait === 1 ? '' : 's'}`
}

export function placeCraftOrder(state: GameState, recipeId: string): GameState {
  const recipe = getRecipe(recipeId)
  if (!recipe || !canCraft(state, recipeId)) return state
  if (!recipe.npcId) return state
  if (getCraftThroughput(state, recipe.npcId) <= 0) return state

  const npcOrders = getCraftOrdersForNpc(state, recipe.npcId)
  const day = state.day ?? 1
  const lastReady = npcOrders.length > 0
    ? Math.max(...npcOrders.map((o) => o.readyOnDay))
    : day - 1
  const readyOnDay = Math.max(day, lastReady) + 1

  let player = spendMaterials(state.player, recipe.requires.materials)
  player = { ...player, gold: player.gold - recipe.requires.gold }

  const order: CraftOrder = {
    id: orderId(),
    recipeId,
    npcId: recipe.npcId,
    itemId: recipe.output.itemId,
    qty: recipe.output.qty,
    readyOnDay,
  }

  const wait = readyOnDay - day
  const crafter = recipe.npcId === 'garrick_smith' ? 'Garrick' : 'The crafter'

  return {
    ...state,
    player,
    craftOrders: [...(state.craftOrders ?? []), order],
    flags: {
      ...(state.flags ?? {}),
      [`crafted_${recipe.output.itemId}`]: true,
    },
    statusMessage: `${crafter} will have your ${getItemName(recipe.output.itemId)} ready in ${wait} day${wait === 1 ? '' : 's'}.`,
  }
}

export function processCraftOrders(state: GameState, newDay?: number): GameState {
  const day = newDay ?? state.day ?? 1
  const orders = state.craftOrders ?? []
  if (orders.length === 0) return state

  const due = orders.filter((o) => o.readyOnDay <= day)
  if (due.length === 0) return state

  const throughput = getCraftThroughput(state, 'garrick_smith') || 1
  const toDeliver = due
    .sort((a, b) => a.readyOnDay - b.readyOnDay)
    .slice(0, throughput)

  let player = state.player
  const deliveredNames: string[] = []
  const deliveredIds = new Set(toDeliver.map((o) => o.id))

  for (const order of toDeliver) {
    player = {
      ...player,
      inventory: addItemToInventory(player.inventory, order.itemId, order.qty),
    }
    deliveredNames.push(getItemName(order.itemId))
  }

  const remaining = orders.filter((o) => !deliveredIds.has(o.id))
  const message = deliveredNames.length === 1
    ? `Garrick delivered your ${deliveredNames[0]}.`
    : `Garrick delivered: ${deliveredNames.join(', ')}.`

  return {
    ...state,
    player,
    craftOrders: remaining,
    statusMessage: message,
  }
}
