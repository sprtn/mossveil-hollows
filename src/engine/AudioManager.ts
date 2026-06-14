/**
 * Background music manager — per-context playlists with crossfade.
 */

import type { GameState } from './GameLoopDesign'
import { AUDIO_PLAYLISTS, type AudioContext } from './audioManifest'
import { DEFAULT_MUSIC_VOLUME, MUSIC_GAIN } from './gameConfig'

const SETTINGS_KEY = 'strat_audio_settings'
const CROSSFADE_MS = 1200

interface AudioSettings {
  volume: number
  muted: boolean
}

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AudioSettings
      if (parsed.volume > 0 && parsed.volume <= 0.55) {
        parsed.volume = DEFAULT_MUSIC_VOLUME
      }
      return parsed
    }
  } catch {
    /* ignore */
  }
  return { volume: DEFAULT_MUSIC_VOLUME, muted: false }
}

function saveSettings(settings: AudioSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* ignore */
  }
}

export function contextForState(state: GameState): AudioContext | null {
  switch (state.phase) {
    case 'game_start':
      return 'town'
    case 'victory':
      return 'victory'
    case 'game_over':
      return 'defeat'
    case 'encounter_action':
    case 'combat_results': {
      const isBoss = state.currentEncounter?.enemies.some((e) => e.isBoss)
        ?? state.currentRoom.isFinalBoss
      return isBoss ? 'boss' : 'combat'
    }
    case 'room_exploring':
    case 'room_enter':
    case 'event':
    case 'dialogue': {
      if (state.currentRoom.isHub) return 'town'
      const zone = state.currentRoom.zoneId
      if (zone === 'cave') return 'explore_cave'
      if (zone === 'ruins') return 'explore_ruins'
      return 'explore_forest'
    }
    default:
      return null
  }
}

class AudioManagerImpl {
  private currentContext: AudioContext | null = null
  private currentAudio: HTMLAudioElement | null = null
  private fadingAudio: HTMLAudioElement | null = null
  private settings: AudioSettings = loadSettings()
  private unlocked = false
  private primed = false
  private fadeTimer: ReturnType<typeof setInterval> | null = null
  private playlistIndex = 0
  private pendingState: GameState | null = null

  get volume(): number {
    return this.settings.volume
  }

  get muted(): boolean {
    return this.settings.muted
  }

  unlock(): void {
    this.unlocked = true
    this.primeAutoplay()
    this.resumePlayback()
  }

  /** Start town music immediately on New Game click (within gesture stack). */
  startOnNewGame(): void {
    this.unlocked = true
    this.primeAutoplay()
    if (this.settings.muted) return
    this.currentContext = null
    this.startContext('town')
  }

  setVolume(volume: number): void {
    this.settings.volume = Math.max(0, Math.min(1, volume))
    if (this.settings.muted) this.settings.muted = false
    saveSettings(this.settings)
    this.applyVolume()
    this.resumePlayback()
  }

  setMuted(muted: boolean): void {
    this.settings.muted = muted
    saveSettings(this.settings)
    this.applyVolume()
    if (!muted) this.resumePlayback()
  }

  toggleMute(): void {
    this.setMuted(!this.settings.muted)
  }

  playForState(state: GameState): void {
    this.pendingState = state
    if (!this.unlocked || this.settings.muted) return

    const context = contextForState(state)
    if (!context) return

    const isPlaying = !!this.currentAudio && !this.currentAudio.paused && !this.currentAudio.ended
    if (context === this.currentContext && isPlaying) return

    this.startContext(context)
  }

  resumePlayback(): void {
    if (!this.unlocked || this.settings.muted || !this.pendingState) return
    const context = contextForState(this.pendingState)
    if (!context) return

    const isPlaying = !!this.currentAudio && !this.currentAudio.paused && !this.currentAudio.ended
    if (isPlaying) {
      this.applyVolume()
      return
    }

    this.startContext(context)
  }

  private targetVolume(): number {
    if (this.settings.muted) return 0
    return Math.min(1, this.settings.volume * MUSIC_GAIN)
  }

  private primeAutoplay(): void {
    if (this.primed) return
    const url = AUDIO_PLAYLISTS.town[0]
    if (!url) return

    const primer = new Audio(url)
    primer.volume = 0.01
    primer
      .play()
      .then(() => {
        primer.pause()
        primer.src = ''
        this.primed = true
      })
      .catch(() => {})
  }

  private applyVolume(): void {
    if (this.currentAudio) this.currentAudio.volume = this.targetVolume()
  }

  private startContext(context: AudioContext): void {
    const playlist = AUDIO_PLAYLISTS[context]
    if (!playlist || playlist.length === 0) return
    this.playlistIndex = 0
    this.playTrack(context, 0)
  }

  private playTrack(context: AudioContext, index: number): void {
    if (!this.unlocked || this.settings.muted) return

    const playlist = AUDIO_PLAYLISTS[context]
    if (!playlist || index >= playlist.length) {
      this.currentContext = null
      return
    }

    const url = playlist[index]
    if (!url) {
      this.playTrack(context, index + 1)
      return
    }

    const singleTrack = playlist.length === 1
    const audio = new Audio(url)
    audio.loop = singleTrack
    audio.volume = 0

    if (!singleTrack) {
      audio.addEventListener('ended', () => this.handleTrackEnded(audio))
    }

    audio
      .play()
      .then(() => {
        this.currentContext = context
        this.playlistIndex = index
        this.crossfadeTo(audio)
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        audio.src = ''
        if (index + 1 < playlist.length) {
          this.playTrack(context, index + 1)
          return
        }
        this.currentContext = null
      })
  }

  private handleTrackEnded(audio: HTMLAudioElement): void {
    if (audio !== this.currentAudio || !this.currentContext) return
    const playlist = AUDIO_PLAYLISTS[this.currentContext]
    const nextIndex = (this.playlistIndex + 1) % playlist.length
    this.playTrack(this.currentContext, nextIndex)
  }

  next(): void {
    if (!this.currentContext) return
    const playlist = AUDIO_PLAYLISTS[this.currentContext]
    if (playlist.length <= 1) return
    const nextIndex = (this.playlistIndex + 1) % playlist.length
    this.playTrack(this.currentContext, nextIndex)
  }

  private crossfadeTo(next: HTMLAudioElement): void {
    if (this.fadeTimer) clearInterval(this.fadeTimer)

    const prev = this.currentAudio
    if (this.fadingAudio && this.fadingAudio !== prev) {
      this.fadingAudio.pause()
      this.fadingAudio.src = ''
    }
    this.fadingAudio = prev
    this.currentAudio = next

    const targetVol = this.targetVolume()

    if (!prev) {
      next.volume = targetVol
      return
    }

    const steps = 24
    const stepMs = CROSSFADE_MS / steps
    let step = 0

    this.fadeTimer = setInterval(() => {
      step++
      const t = step / steps
      next.volume = targetVol * t
      if (prev) prev.volume = Math.max(0, targetVol * (1 - t))

      if (step >= steps) {
        if (this.fadeTimer) clearInterval(this.fadeTimer)
        this.fadeTimer = null
        if (prev) {
          prev.pause()
          prev.src = ''
        }
        this.fadingAudio = null
        next.volume = targetVol
      }
    }, stepMs)
  }
}

export const audioManager = new AudioManagerImpl()
