/**
 * Audio manifest — playlists per game context.
 * Tracks live in public/audio/. Missing files are handled gracefully (no crash).
 * A context with multiple tracks plays them in sequence (advancing on song end);
 * a single-track context loops.
 */

export type AudioContext =
  | 'town'
  | 'explore_forest'
  | 'explore_cave'
  | 'explore_ruins'
  | 'combat'
  | 'boss'
  | 'victory'
  | 'defeat'

export const AUDIO_PLAYLISTS: Record<AudioContext, string[]> = {
  town: ['/audio/sleepy_town.mp3', '/audio/sleepy_town_square.mp3'],
  explore_forest: ['/audio/mosslight_hollow.mp3', '/audio/mossveil_path.mp3'],
  // Reuse forest/town tracks until dedicated files are added.
  explore_cave: ['/audio/mosslight_hollow.mp3'],
  explore_ruins: ['/audio/mossveil_path.mp3'],
  combat: ['/audio/mossveil_path.mp3'],
  boss: ['/audio/mosslight_hollow.mp3'],
  victory: ['/audio/sleepy_town_square.mp3'],
  defeat: ['/audio/sleepy_town.mp3'],
}
