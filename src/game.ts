export const PROXIMITY_TOLERANCE = 64
export const BOARD_OBJECT_SIZE = 84
export const BOARD_IMAGE_OBJECT_SIZE = 176
export const BOARD_OBJECT_MIN_SIZE = 56
export const BOARD_WIDTH = 1120
export const BOARD_HEIGHT = 650
const BOARD_CENTER = BOARD_WIDTH / 2
const DIVIDER_CLEARANCE = 12
export const ENGINE_SLUG = 'ftm'
export const SPEECH_LANGS: Record<string, string> = { english: 'en' }

// Mirrors the CSS clamp() used for .match-object sizing, so drag-clamp math always
// matches the object's actual rendered footprint at any board scale.
export function boardObjectSize(scale: number, maxSize = BOARD_OBJECT_SIZE): number {
  return Math.min(maxSize, Math.max(BOARD_OBJECT_MIN_SIZE, maxSize * scale))
}

export function boardObjectWidth(
  item: BoardObject,
  objects: BoardObject[],
  scale: number,
  maxSize = BOARD_OBJECT_SIZE,
): number {
  const size = boardObjectSize(scale, maxSize)
  if (item.type === 'audio' || item.image) return size

  const scaleFactor = size / maxSize
  const desiredWidth = size + Math.max(0, item.target.length - 3) * size * 0.3
  const sideWidth = (x: number) =>
    Math.max(0, 2 * Math.min(x, BOARD_WIDTH - x, Math.abs(x - BOARD_CENTER) - DIVIDER_CLEARANCE) * scaleFactor)
  const ownLimit = sideWidth(item.pos[0])
  const partnerLimit = item.pair_id
    .map((id) => objects.find((candidate) => candidate.object_id === id))
    .filter((candidate): candidate is BoardObject => candidate !== undefined)
    .map((candidate) => {
      const candidateDesiredWidth = candidate.type === 'audio' || candidate.image
        ? size
        : size + Math.max(0, candidate.target.length - 3) * size * 0.3
      const candidateWidth = Math.min(candidateDesiredWidth, sideWidth(candidate.pos[0]))
      return sideWidth(candidate.pos[0]) - candidateWidth
    })
    .reduce((widest, limit) => Math.max(widest, limit), 0)
  const maxWidth = Math.min(ownLimit, partnerLimit || ownLimit)
  return Math.max(size, Math.min(desiredWidth, maxWidth))
}

export type Side = 'left' | 'right'
export type ObjectType = 'letter' | 'audio'
const OBJECT_TYPES: readonly string[] = ['letter', 'audio']

export interface TrialObject {
  object_id: string
  pos: [number, number]
  target: string
  type: ObjectType
  pair_id: string[]
  image?: string
  audio?: string
}

export interface Trial {
  trial_num: number
  left: TrialObject[]
  right: TrialObject[]
}

export interface BoardObject extends TrialObject {
  side: Side
  x: number
  y: number
  solved: boolean
  mergedInto?: string
}

export function loadBinary(url: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.responseType = 'arraybuffer'
    xhr.onload = () => {
      if (xhr.status === 0 || xhr.status === 200) resolve(xhr.response)
      else reject(new Error(`XHR ${xhr.status} for ${url}`))
    }
    xhr.onerror = () => reject(new Error(`XHR error for ${url}`))
    xhr.send()
  })
}

export async function loadTrial(url: string): Promise<Trial> {
  const buffer = await loadBinary(url)
  return validateTrial(JSON.parse(new TextDecoder().decode(buffer)) as unknown)
}

export function trialNumberFromSearch(search: string): number {
  const value = new URLSearchParams(search).get('trial') ?? ''
  return /^[1-9]\d*$/.test(value) ? Number(value) : 1
}

export function trialPath(langCode: string, trialNum: number): string {
  return `lang/${langCode}/trials/trial-${trialNum}.json`
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function validateObject(value: unknown, ids: Set<string>): TrialObject {
  if (!isObject(value) || typeof value.object_id !== 'string' || typeof value.target !== 'string') {
    throw new Error('Each trial object needs object_id and target')
  }
  if (!Array.isArray(value.pos) || value.pos.length !== 2 || !value.pos.every((part) => typeof part === 'number')) {
    throw new Error(`Invalid position for ${value.object_id}`)
  }
  if (!Array.isArray(value.pair_id) || value.pair_id.length === 0 || !value.pair_id.every((id) => typeof id === 'string')) {
    throw new Error(`Invalid pair_id for ${value.object_id}`)
  }
  if (ids.has(value.object_id)) throw new Error(`Duplicate object_id ${value.object_id}`)
  if (value.type !== undefined && (typeof value.type !== 'string' || !OBJECT_TYPES.includes(value.type))) {
    throw new Error(`Invalid type for ${value.object_id}`)
  }
  ids.add(value.object_id)
  return {
    object_id: value.object_id,
    pos: [value.pos[0] as number, value.pos[1] as number],
    target: value.target,
    type: (value.type as ObjectType | undefined) ?? 'letter',
    pair_id: value.pair_id as string[],
    ...(typeof value.image === 'string' ? { image: value.image } : {}),
    ...(typeof value.audio === 'string' ? { audio: value.audio } : {}),
  }
}

export function validateTrial(value: unknown): Trial {
  if (!isObject(value) || typeof value.trial_num !== 'number' || !Array.isArray(value.left) || !Array.isArray(value.right)) {
    throw new Error('Trial must contain trial_num, left, and right')
  }
  const ids = new Set<string>()
  const left = value.left.map((item) => validateObject(item, ids))
  const right = value.right.map((item) => validateObject(item, ids))
  const allIds = new Set([...left, ...right].map((item) => item.object_id))
  for (const item of [...left, ...right]) {
    if (item.pair_id.some((id) => !allIds.has(id))) throw new Error(`Unknown pair_id in ${item.object_id}`)
  }
  return { trial_num: value.trial_num, left, right }
}

export function makeBoardObjects(trial: Trial, solvedIds: Set<string>): BoardObject[] {
  const order = [...solvedIds]
  const all: BoardObject[] = [
    ...trial.left.map((item) => ({ ...item, side: 'left' as const, x: item.pos[0], y: item.pos[1], solved: solvedIds.has(item.object_id) })),
    ...trial.right.map((item) => ({ ...item, side: 'right' as const, x: item.pos[0], y: item.pos[1], solved: solvedIds.has(item.object_id) })),
  ]
  return all.map((item) => {
    if (!item.solved) return item
    // Pairs persist as [dragged, partner], so the later id hosts the combined tile.
    const host = item.pair_id.find((id) => solvedIds.has(id) && order.indexOf(id) > order.indexOf(item.object_id))
    return host ? { ...item, mergedInto: host } : item
  })
}

export function nearestCandidate(dragged: BoardObject, objects: BoardObject[]): BoardObject | null {
  return objects
    .filter((item) => item.side !== dragged.side && !item.solved)
    .map((item) => ({ item, distance: Math.hypot(item.x - dragged.x, item.y - dragged.y) }))
    .filter(({ distance }) => distance <= PROXIMITY_TOLERANCE)
    .sort((a, b) => a.distance - b.distance)[0]?.item ?? null
}

export function progressKey(trialNum: number): string { return `ftm:trial:${trialNum}:solved` }

export function readSolvedIds(trialNum: number): Set<string> {
  try {
    const value = localStorage.getItem(progressKey(trialNum))
    const ids: unknown = value ? JSON.parse(value) : []
    return new Set(Array.isArray(ids) && ids.every((id) => typeof id === 'string') ? ids : [])
  } catch { return new Set() }
}

export function writeSolvedIds(trialNum: number, ids: Set<string>): void {
  try { localStorage.setItem(progressKey(trialNum), JSON.stringify([...ids])) } catch { /* restricted WebView */ }
}

export function emitContainerEvent(userId: string | null, type: 'trial_completed' | 'summary_data', data: Record<string, unknown>): void {
  try {
    window.ReactNativeWebView?.postMessage(JSON.stringify({
      payload_id: `${ENGINE_SLUG}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      cr_user_id: userId, sub_app_id: ENGINE_SLUG, payload_version: '1.0',
      collection: type === 'summary_data' ? 'summary_data' : 'user_sessions_data',
      timestamp: new Date().toISOString(), data,
    }))
  } catch { /* reporting never affects gameplay */ }
}

let audioContext: AudioContext | null = null
const audioBuffers = new Map<string, AudioBuffer>()

function getAudioContext(): AudioContext | null {
  try {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      audioContext = new AudioContextClass()
    }
    if (audioContext.state === 'suspended') void audioContext.resume()
    return audioContext
  } catch { return null }
}

export async function preloadAudio(trial: Trial): Promise<void> {
  // Some browsers populate the voice list lazily; asking early warms it up.
  try { window.speechSynthesis?.getVoices() } catch { /* no speech support */ }
  const context = getAudioContext()
  if (!context) return
  const paths = new Set([...trial.left, ...trial.right].flatMap((item) => (item.audio ? [item.audio] : [])))
  await Promise.allSettled([...paths].map(async (path) => {
    audioBuffers.set(path, await context.decodeAudioData(await loadBinary(path)))
  }))
}

// Only on-device voices, since network voices fail offline.
function speak(text: string, langCode: string): boolean {
  try {
    if (!('speechSynthesis' in window)) return false
    const lang = SPEECH_LANGS[langCode] ?? SPEECH_LANGS.english
    const voice = window.speechSynthesis
      .getVoices()
      .find((candidate) => candidate.localService && candidate.lang.toLowerCase().startsWith(lang))
    if (!voice) return false
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voice
    utterance.lang = voice.lang
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    return true
  } catch { return false }
}

export function playPronunciation(item: Pick<TrialObject, 'audio' | 'target'>, langCode: string): void {
  const buffer = item.audio ? audioBuffers.get(item.audio) : undefined
  const context = getAudioContext()
  if (buffer && context) {
    try {
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      source.start()
      return
    } catch { /* fall through to generated voice */ }
  }
  if (!speak(item.target, langCode)) playTone('target')
}

export function playTone(kind: 'match' | 'miss' | 'target'): void {
  try {
    const context = getAudioContext()
    if (!context) return
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const notes = kind === 'match' ? [523, 659, 784] : kind === 'miss' ? [180, 130] : [440]
    const now = context.currentTime
    oscillator.type = kind === 'miss' ? 'sawtooth' : 'sine'
    oscillator.frequency.setValueAtTime(notes[0], now)
    notes.slice(1).forEach((note, index) => oscillator.frequency.setValueAtTime(note, now + (index + 1) * 0.12))
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, now + (kind === 'match' ? 0.48 : 0.28))
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + (kind === 'match' ? 0.5 : 0.3))
  } catch { /* optional audio */ }
}

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void }
    webkitAudioContext?: typeof AudioContext
  }
}