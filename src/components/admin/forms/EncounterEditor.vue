<template>
  <div class="encounter-list">
    <div v-for="(enc, ei) in encounters" :key="ei" class="encounter-card">
      <div class="encounter-header">
        <span class="encounter-title">Encounter {{ ei + 1 }}</span>
        <button type="button" class="btn-icon btn-danger-icon" @click="removeEncounter(ei)">✕</button>
      </div>
      <div class="form-grid-2">
        <label class="field-label">
          ID
          <input v-model="enc.id" type="text" class="field-input" placeholder="enc_1" />
        </label>
        <label class="field-label">
          Type
          <select v-model="enc.type" class="field-select">
            <option value="fixed">fixed</option>
            <option value="random">random</option>
          </select>
        </label>
        <label class="field-label">
          Trigger Chance
          <input
            v-model.number="enc.triggerChance"
            type="number"
            class="field-input"
            min="0"
            max="1"
            step="0.05"
            placeholder="0–1"
          />
        </label>
        <label class="field-label">
          On Trigger
          <select v-model="enc.onTrigger" class="field-select">
            <option value="">—</option>
            <option value="auto">auto</option>
            <option value="on_move">on_move</option>
          </select>
        </label>
      </div>

      <div class="enemies-section">
        <div class="enemies-header">
          <span class="section-label">Enemies</span>
          <button type="button" class="btn btn-secondary btn-xs" @click="addEnemy(enc)">+ Enemy</button>
        </div>
        <div v-for="(enemy, eni) in enc.enemies" :key="eni" class="enemy-row">
          <div class="form-grid-3">
            <label class="field-label">
              ID
              <input v-model="enemy.id" type="text" class="field-input" placeholder="goblin_1" />
            </label>
            <label class="field-label">
              Name
              <input v-model="enemy.name" type="text" class="field-input" placeholder="Goblin" />
            </label>
            <label class="field-label">
              Level
              <input v-model.number="enemy.level" type="number" class="field-input" min="1" />
            </label>
            <label class="field-label">
              HP
              <input v-model.number="enemy.hp" type="number" class="field-input" min="1" />
            </label>
            <label class="field-label">
              Max HP
              <input v-model.number="enemy.maxHp" type="number" class="field-input" min="1" />
            </label>
            <label class="field-label">
              Archetype
              <select v-model="enemy.archetype" class="field-select">
                <option value="">—</option>
                <option value="attacker">attacker</option>
                <option value="defender">defender</option>
                <option value="caster">caster</option>
              </select>
            </label>
            <label class="field-label">
              XP Reward
              <input v-model.number="enemy.xpReward" type="number" class="field-input" min="0" />
            </label>
            <label class="field-label">
              Gold Reward
              <input v-model.number="enemy.goldReward" type="number" class="field-input" min="0" />
            </label>
            <label class="field-label enemy-boss">
              <input v-model="enemy.isBoss" type="checkbox" />
              Boss
            </label>
          </div>
          <button
            type="button"
            class="btn-icon btn-danger-icon enemy-remove"
            @click="removeEnemy(enc, eni)"
          >✕</button>
        </div>
      </div>
    </div>
    <button type="button" class="btn btn-secondary btn-sm" @click="addEncounter">+ Encounter</button>
  </div>
</template>

<script setup lang="ts">
import type { EncounterDef, Enemy } from '@/engine/GameLoopDesign'

const encounters = defineModel<EncounterDef[]>({ default: () => [] })

function makeEnemy(): Enemy {
  return {
    id: `enemy_${Date.now()}`,
    name: '',
    hp: 10,
    maxHp: 10,
    level: 1,
    stats: { strength: 5, constitution: 5, dexterity: 5, agility: 5, defense: 2 },
  }
}

function addEncounter() {
  encounters.value = [
    ...encounters.value,
    { id: `enc_${Date.now()}`, type: 'random', enemies: [makeEnemy()], triggerChance: 0.3 },
  ]
}

function removeEncounter(i: number) {
  encounters.value = encounters.value.filter((_, idx) => idx !== i)
}

function addEnemy(enc: EncounterDef) {
  enc.enemies = [...enc.enemies, makeEnemy()]
}

function removeEnemy(enc: EncounterDef, i: number) {
  enc.enemies = enc.enemies.filter((_, idx) => idx !== i)
}
</script>

<style scoped>
.encounter-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.encounter-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 10px;
  background: var(--color-bg);
}

.encounter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.encounter-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-accent);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 10px;
}

.form-grid-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  flex: 1;
}

.field-label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-soft);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.enemy-boss {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  justify-content: flex-start;
  padding-top: 18px;
}

.field-input,
.field-select {
  padding: 5px 7px;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--color-text);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.field-input:focus,
.field-select:focus {
  outline: none;
  border-color: var(--color-accent);
}

.enemies-section {
  margin-top: 8px;
}

.enemies-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-soft);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.enemy-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 8px;
  padding: 8px;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.enemy-remove {
  margin-top: 18px;
  flex-shrink: 0;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  font-size: 13px;
  border-radius: var(--radius-sm);
}

.btn-danger-icon {
  color: var(--color-danger, #c0392b);
}

.btn-danger-icon:hover {
  background: rgba(192, 57, 43, 0.15);
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
  align-self: flex-start;
}

.btn-xs {
  padding: 3px 8px;
  font-size: 11px;
}
</style>
