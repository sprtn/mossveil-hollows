#!/usr/bin/env node
/**
 * Merge a content-overlay bundle into src/assets/.
 *
 * Usage:
 *   node scripts/merge-overlay.mjs path/to/content-overlay-v1.json
 *
 * Reads an exported overlay bundle (version 1) and:
 *   - Writes each upsert to the matching asset file ({folder}/{id}.json)
 *   - Deletes asset files listed in deletedIds
 *   - Merges roomLayouts into src/assets/map/room_layouts.json
 *
 * Intended for authors who edited content in the dev admin overlay and want
 * to commit changes back to the repo. Does not modify localStorage or the
 * runtime overlay — run separately from the in-game Import/Export buttons.
 *
 * After merging, review the git diff and run `npm run build`.
 */

import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ASSETS_ROOT = join(__dirname, '..', 'src', 'assets')

/** Content type key → asset subdirectory (relative to src/assets). */
const TYPE_DIRS = {
  rooms: 'rooms',
  npcs: 'npcs',
  quests: 'quests',
  questlines: 'questlines',
  dialogues: 'dialogue',
  items: 'items',
  events: 'events',
  recipes: 'recipes',
  buildings: 'buildings',
  skills: 'skills',
  encounterTemplates: 'encounters',
}

const BUNDLE_VERSION = 1

function usage() {
  console.error('Usage: node scripts/merge-overlay.mjs <content-overlay-v1.json>')
  process.exit(1)
}

function ensureDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true })
}

function writeEntity(dir, id, entity) {
  const filePath = join(ASSETS_ROOT, dir, `${id}.json`)
  ensureDir(filePath)
  writeFileSync(filePath, `${JSON.stringify(entity, null, 2)}\n`, 'utf8')
  return filePath
}

function deleteEntity(dir, id) {
  const filePath = join(ASSETS_ROOT, dir, `${id}.json`)
  if (!existsSync(filePath)) {
    console.warn(`  skip delete (not found): ${filePath}`)
    return null
  }
  unlinkSync(filePath)
  return filePath
}

function mergeRoomLayouts(bundle) {
  const layouts = bundle.roomLayouts
  if (!layouts || Object.keys(layouts).length === 0) return 0

  const filePath = join(ASSETS_ROOT, 'map', 'room_layouts.json')
  let existing = {}
  if (existsSync(filePath)) {
    existing = JSON.parse(readFileSync(filePath, 'utf8'))
  }
  const merged = { ...existing, ...layouts }
  ensureDir(filePath)
  writeFileSync(filePath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  console.log(`  write ${filePath} (${Object.keys(layouts).length} layout(s))`)
  return Object.keys(layouts).length
}

function mergeOverlay(bundlePath) {
  const absPath = resolve(bundlePath)
  const raw = readFileSync(absPath, 'utf8')
  const bundle = JSON.parse(raw)

  if (bundle.version !== BUNDLE_VERSION) {
    throw new Error(`Unsupported bundle version: ${bundle.version ?? 'missing'} (expected ${BUNDLE_VERSION})`)
  }

  const upserts = bundle.upserts ?? {}
  const deletedIds = bundle.deletedIds ?? {}
  let written = 0
  let removed = 0

  for (const [type, dir] of Object.entries(TYPE_DIRS)) {
    const entities = upserts[type] ?? {}
    for (const [id, entity] of Object.entries(entities)) {
      const path = writeEntity(dir, id, entity)
      console.log(`  write ${path}`)
      written++
    }

    for (const id of deletedIds[type] ?? []) {
      const path = deleteEntity(dir, id)
      if (path) {
        console.log(`  delete ${path}`)
        removed++
      }
    }
  }

  const layoutsWritten = mergeRoomLayouts(bundle)
  return { written, removed, layoutsWritten }
}

const bundleArg = process.argv[2]
if (!bundleArg) usage()

try {
  console.log(`Merging overlay bundle: ${resolve(bundleArg)}`)
  const { written, removed, layoutsWritten } = mergeOverlay(bundleArg)
  console.log(`Done. ${written} file(s) written, ${removed} file(s) deleted, ${layoutsWritten} layout(s) merged.`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
