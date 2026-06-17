/** Game-wide constants */
export const GAME_TITLE = 'Mossveil Hollow: Shards of the Shadow'
export const GAME_TITLE_MAIN = 'Mossveil Hollow'
export const GAME_TITLE_SUB = 'Shards of the Shadow'

export const START_ROOM_ID = 'town_hub'
export const FINAL_BOSS_ENEMY_ID = 'shadow_lord'
export const SAVE_KEY = 'strat_rpg_save'
export const SAVE_VERSION = 10

export const ZONE_IDS = ['forest', 'cave', 'ruins'] as const
export type ZoneId = (typeof ZONE_IDS)[number]

export const ZONE_BOSS_IDS: Record<ZoneId, string> = {
  forest: 'forest_guardian',
  cave: 'cave_warden',
  ruins: 'ruins_sentinel',
}

export const ZONE_SHARD_IDS: Record<ZoneId, string> = {
  forest: 'forest_shard',
  cave: 'cave_shard',
  ruins: 'ruins_shard',
}

/** Stamina — expedition budget */
export const DEFAULT_MAX_STAMINA = 10
export const STAMINA_PER_MOVE = 1
export const STAMINA_PER_ENCOUNTER = 1
/** Stamina per explore attempt (paid before outcome roll). */
export const EXPLORE_STAMINA_COST = 1

/** Zone boss respawn — days after first clear before the guardian returns. */
export const BOSS_RESPAWN_DAYS = 7
/** Farm respawn reward tuning (first-kill rewards unchanged). */
export const BOSS_RESPAWN_XP_MULTIPLIER = 0.4
export const BOSS_RESPAWN_GOLD_MULTIPLIER = 0.4

/** Wild berry gather nodes (see forest room gatherNodes; values should match). */
export const BERRY_NODE_BASE_YIELD = 1
export const BERRY_NODE_MAX_CHARGES = 6
export const BERRY_NODE_REGEN_PER_DAY = 2
/** Energy restored when eating gathered berries (also berries.json power). */
export const BERRY_ENERGY_RESTORE = 2

/** Energy — combat resource (persists across expedition) */
export const DEFAULT_MAX_ENERGY = 6
export const ENERGY_PER_WIN = 1

/** Healer — premium recovery */
export const HEALER_COST = 25
export const HEALER_HP_RESTORE = 999
export const HEALER_ENERGY_RESTORE = 999
export const HEALER_STAMINA_RESTORE = 999

/** Free rest — safe partial recovery (never lowers current values) */
export const REST_HP_PERCENT = 0.6
export const REST_ENERGY_PERCENT = 0.6
export const REST_STAMINA_PERCENT = 0.6

/** Inn — paid safe sleep */
export const INN_COST = 8
export const INN_HP_PERCENT = 1.0

/** Wounded status */
export const WOUNDED_MAX_HP_PENALTY = 0.2

/** Training — stat-based skill acquisition (gold + day per attempt). */
export const TRAINING_DAYS_PER_ATTEMPT = 1
/** Success chance at exactly minStat (linear ramp to 100% at maxStat). */
export const TRAINING_MIN_SUCCESS_PCT = 0.08

/** Make Camp — out-of-combat rest in zones. */
export const CAMP_HP_PERCENT = 0.8
export const CAMP_ENERGY_PERCENT = 0.8
export const CAMP_STAMINA_PERCENT = 0.8
export const CAMP_AMBUSH_CHANCE_SCALE = 0.08

/** Event chance on explore (after combat check) */
export const EVENT_CHANCE_ON_EXPLORE = 0.35

/** Background music — HTMLAudioElement.volume is capped at 1; gain boosts quiet masters. */
export const DEFAULT_MUSIC_VOLUME = 0.85
export const MUSIC_GAIN = 1.45
