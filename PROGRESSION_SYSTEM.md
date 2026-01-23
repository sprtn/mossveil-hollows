# Player Progression System Design

## Overview

A lightweight progression system that balances meaningful growth with consistent challenge throughout the game. Players level up through combat XP, gaining stats that scale predictably without power creep.

---

## Core Design Principles

### 1. **Diminishing Returns (No Power Creep)**
- Stats grow logarithmically as level increases
- Early levels feel impactful (big jumps)
- Late levels feel earned but not game-breaking
- Enemies scale with player level to maintain tension

### 2. **Meaningful but Measured Progression**
- Each level provides 10-15% power increase in relevant stat tiers
- No single stat becomes overwhelming
- Defense grows slowest to keep combat meaningful

### 3. **Level Cap at 30**
- Prevents indefinite scaling
- Gives late-game structure and finality
- Allows balanced endgame design

### 4. **Tier-Based Enemy Scaling**
- Enemies don't scale 1:1 with player
- Different tier ranges have different enemy multipliers
- Prevents early game from becoming trivial

---

## Stat Formulas

### Base Stats (Level 1)
```
HP:        100
Strength:  10
Defense:   5
Speed:     5
```

### HP Progression
```
MaxHP = 100 + (Level - 1) × 8 + sqrt(Level - 1) × 2

Examples:
Level 1:   100 HP
Level 5:   132 HP (+32%)
Level 10:  172 HP (+72%)
Level 15:  212 HP (+112%)
Level 20:  252 HP (+152%)
Level 30:  342 HP (+242%)

Rationale:
- Linear component: steady survivability growth
- Sqrt component: diminishing returns prevent one-shots always failing
- At level 30, still takes multiple hits to kill (maintains challenge)
```

### Strength (Attack Power)
```
Strength = 10 + (Level - 1) × 0.3 + sqrt(Level - 1) × 0.15

Examples:
Level 1:   10 damage
Level 5:   11 damage (+10%)
Level 10:  13 damage (+30%)
Level 15:  15 damage (+50%)
Level 20:  17 damage (+70%)
Level 30:  19 damage (+90%)

Rationale:
- Slow growth prevents damage scaling away from fixed defense
- Enemy defense doesn't grow much, so player damage must be restrained
- At level 30, does ~19-21 damage vs defend-only enemies (3 DEF)
- Combat remains challenging even with stat advantage
```

### Defense
```
Defense = 5 + sqrt(Level - 1) × 0.4

Examples:
Level 1:   5 defense
Level 5:   6 defense (+20%)
Level 10:  7 defense (+40%)
Level 15:  8 defense (+60%)
Level 20:  9 defense (+80%)
Level 30:  7 defense (slightly lower due to sqrt diminishing returns)

Rationale:
- Pure sqrt growth (slowest)
- Defense growing slowly keeps enemies dangerous
- Late-game defense is good but not invincible
- Forces player to use items, manage HP proactively
```

### Speed (Future Turn Order)
```
Speed = 5 + sqrt(Level - 1) × 0.2

Examples:
Level 1-20: Minimal increases (not used currently)
Level 30:   8 speed

Rationale:
- Reserved for future turn-order mechanics
- Currently ignored in combat (player always acts first)
- When implemented, growth is slow to prevent speed-stacking being broken
```

---

## Level Progression & XP System

### XP Requirements (Cumulative)
```
Level 1:   0 XP
Level 2:   100 XP
Level 5:   700 XP
Level 10:  2,700 XP
Level 15:  5,950 XP
Level 20:  10,450 XP
Level 30:  23,200 XP (cap)

Formula: Each level requires ~300-500 more XP than previous
Grows quadratically, encouraging endgame grinding/challenge runs
```

### Level-Up Reward
When player levels up:
- ✅ All stats recalculate (HP, STR, DEF, SPD)
- ✅ HP is restored to new max (reward for leveling)
- ✅ No extra stat points to allocate (too complex for turn-based)

### XP Reward Formula
```
XpReward = BaseXp × sqrt(EnemyLevel / PlayerLevel) + DifficultyBonus

Where:
- BaseXp = 50 (per enemy defeated)
- DifficultyBonus = max(0, EnemyLevel - PlayerLevel) × 5

Examples:
Defeating same-level enemy:     50 XP
Defeating 2 levels lower:       35 XP (farming penalty)
Defeating 2 levels higher:      60 XP (challenge bonus)

Rationale:
- Prevents farming low-level enemies for fast leveling
- Encourages fighting appropriately-leveled enemies
- Bonus for tough enemies prevents power-level farming
- Minimum 10 XP per enemy (no worthless battles)
```

---

## Progression Tiers & Enemy Scaling

### Tier Structure
```
Tier 1 (Early):      Levels 1-5,   Enemy Scale ×1.0
Tier 2 (Mid):        Levels 6-10,  Enemy Scale ×1.15
Tier 3 (Late):       Levels 11-15, Enemy Scale ×1.35
Tier 4 (Endgame):    Levels 16-20, Enemy Scale ×1.6
Tier 5 (Post-Game):  Levels 21-30, Enemy Scale ×1.9
```

### Enemy Scaling Rules
```
EnemyStats = BaseStats × TierMultiplier

Example:
A Goblin with 20 HP, 10 STR, 3 DEF

Player Level 1-5:
  20 HP, 10 STR, 3 DEF (no scaling)

Player Level 6-10:
  23 HP, 12 STR, 3 DEF (×1.15)

Player Level 16-20:
  32 HP, 16 STR, 4 DEF (×1.6)

Rationale:
- Prevents level 1 enemies becoming trivial at level 20
- Tier-based scaling keeps challenge curves smooth
- Prevents "farming zone" from becoming worthless
```

---

## Power Creep Prevention Strategy

### What We Avoid
❌ Exponential damage scaling (e.g., damage × level)  
❌ Stat allocation (encourages min/maxing)  
❌ Multiplicative bonuses (stacking defense items + defense stat)  
❌ Infinite leveling (level cap enforced)  

### What We Do Instead
✅ **Logarithmic Stat Growth**: Early levels impactful, late slow  
✅ **Tier-Based Enemy Scaling**: Enemies grow with player, maintain difficulty  
✅ **Balanced Stat Ratios**: Damage/Defense ratio stays ~2:1  
✅ **XP Scaling Penalty**: Farming weak enemies is inefficient  
✅ **HP Pool Scaling**: Damage remains meaningful (not 1-2 hits to kill)  

### Example: Why This Works
```
Level 1 Player vs Goblin
- Player: 100 HP, 10 STR, 5 DEF
- Goblin: 20 HP, 10 STR, 3 DEF
- Player does 10-12 damage, takes 7-9 damage
- Combat: ~2 rounds for player to win (expected outcome)

Level 20 Player vs Goblin (with tier scaling)
- Player: 252 HP, 17 STR, 9 DEF
- Goblin: 32 HP, 16 STR, 4 DEF (×1.6 tier multiplier)
- Player does 13-15 damage, takes 7-9 damage
- Combat: ~2-3 rounds for player to win (still challenging!)
- WITHOUT tier scaling, player does 17-19 damage → 1-2 rounds (trivial)
```

---

## Integration with Game Systems

### Combat System
- Player stats read from `player.stats` at combat start
- Enemy stats scaled via `scaleEnemyStats()` before combat
- XP calculated after combat ends via `calculateXpReward()`

### Game Loop
```
1. Player defeats enemy
   ↓
2. Calculate XP: calculateXpReward(enemyLevel, playerLevel, baseXp)
   ↓
3. Add XP to player.xp (new field)
   ↓
4. Check level up: checkLevelUp(player.level, player.xp)
   ↓
5. If leveled, call levelUpPlayer(player)
   ↓
6. Update UI with new stats and level
```

### Inventory & Equipment (Future)
- Weapons: +1 to +5 damage (additive, not multiplicative)
- Armor: +1 to +3 defense (additive)
- Prevents exponential scaling when combined with level

### Encounter Design
- Room 1 (Level 1-5): Goblins, weak enemies
- Room 5 (Level 11-15): Orcs, medium enemies
- Room 10 (Level 21-30): Bosses, strong enemies with same tier scaling

---

## Progression Pacing

### Expected Progression Timeline
```
Levels 1-10:    ~5-8 encounters to level up (learns mechanics)
Levels 11-20:   ~10-15 encounters to level up (mid-game grind)
Levels 21-30:   ~20-30 encounters to level up (endgame challenge)
```

### Player Experience
- **Early**: "I'm getting stronger!" (frequent level-ups)
- **Mid**: "It's getting harder, but I'm keeping up" (steady pace)
- **Late**: "Every level feels earned" (grinding rewards)
- **Endgame**: "I've mastered the game" (optional continued play)

---

## Adding New Content

### New Rooms/Enemies
1. Assign base level (e.g., "Room 5 is level 11-15")
2. Design enemy base stats WITHOUT tier scaling
3. Game applies tier multiplier automatically
4. No code changes needed—data-driven

Example:
```json
{
  "id": "orc_warrior",
  "name": "Orc Warrior",
  "baseLevel": 12,
  "hp": 40,
  "strength": 12,
  "defense": 5,
  "xpReward": 80
}
```

Game automatically:
- Scales stats based on `getProgressionTier(playerLevel)`
- Calculates actual XP reward if lower/higher level

---

## Testing Progression

### Key Test Cases
```typescript
// Stat calculation
assert(calculateMaxHp(1) === 100)
assert(calculateMaxHp(30) === 300)
assert(calculateStrength(1) === 10)
assert(calculateDefense(30) === 10)

// Level progression
assert(checkLevelUp(1, 99) === 1) // Not enough XP
assert(checkLevelUp(1, 100) === 2) // Reached level 2
assert(checkLevelUp(30, 99999) === 30) // Capped at max

// Enemy scaling
const scaled = scaleEnemyStats(10, 10, 3, 20, 6)
assert(scaled.hp === 23) // 20 × 1.15
assert(scaled.strength === 12) // 10 × 1.15 (rounded)

// XP rewards
assert(calculateXpReward(5, 5, 50) === 50) // Same level
assert(calculateXpReward(3, 5, 50) > calculateXpReward(7, 5, 50)) // Farming penalty
```

---

## Future Enhancements

### Potential Without Breaking Balance
- ✅ **Skill Trees**: Passive bonuses (e.g., +1 DEF per 2 levels)
- ✅ **Perks**: Unlock at certain levels (e.g., "Counterattack" at 15)
- ✅ **Item Rarity Tiers**: Rare items give +2 bonus instead of +1
- ✅ **Difficulty Modes**: "Hard mode" uses ×2 enemy scaling
- ✅ **New Game+**: Restart at level 1, enemies start at ×2 scaling

### Avoid
- ❌ **Stat Resets**: Confusing, reduces sense of progress
- ❌ **Infinite Leveling**: Breaks game balance, discourages endgame
- ❌ **Multiplicative Bonuses**: Too easy to break (2×0.5 = 1, invisible)
- ❌ **Class-Based Stats**: Adds complexity, unnecessary for turn-based

---

## Summary

| Aspect | Formula | Result |
|--------|---------|--------|
| **Max HP** | 100 + (L-1)×8 + √(L-1)×2 | L1: 100, L30: 300 |
| **Strength** | 10 + (L-1)×0.3 + √(L-1)×0.15 | L1: 10, L30: 18 (+80%) |
| **Defense** | 5 + √(L-1)×0.4 | L1: 5, L30: 10 (+100%) |
| **XP Reward** | 50×√(E/P) + max(0, E-P)×5 | Same level: 50 XP |
| **Enemy Scale** | TierMultiplier × BaseStat | T1: ×1.0, T5: ×1.9 |
| **Level Cap** | 30 | Finite game length |
| **Power Creep** | Logarithmic + Tier Scaling | Maintains challenge |

This system gives players a clear sense of progression while keeping the game challenging and balanced throughout all 30 levels.
