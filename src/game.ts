export const PROXIMITY_TOLERANCE = 64
export const BOARD_OBJECT_SIZE = 84
export const BOARD_IMAGE_OBJECT_SIZE = 176
export const BOARD_OBJECT_MIN_SIZE = 56
export const BOARD_WIDTH = 1120
export const BOARD_HEIGHT = 650
export const MIN_WORD_FONT_SIZE = 16
// Conservative average glyph advance (in em) for the bold Andika word font.
const WORD_CHAR_WIDTH = 0.62
// Horizontal padding plus border inside a word card, in px.
const WORD_INSET = 22
const BOARD_CENTER = BOARD_WIDTH / 2
const DIVIDER_CLEARANCE = 12
export const ENGINE_SLUG = 'ftm'
export const TRIALS_PER_PAGE = 12
const LANGUAGE_CODE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const SPEECH_LOCALE_PATTERN = /^(?:[A-Za-z]{2,3}|[A-Za-z]{4}|[A-Za-z]{5,8})(?:-[A-Za-z0-9]{1,8})*$/

export interface LanguagePack {
  code: string
  speechLocale: string
}

export function validLanguageCode(code: string): boolean {
  return code.length <= 32 && LANGUAGE_CODE_PATTERN.test(code)
}

export function validateLanguagePack(value: unknown, expectedCode: string): LanguagePack {
  if (
    !isObject(value) ||
    Object.keys(value).length !== 2 ||
    value.code !== expectedCode ||
    typeof value.speechLocale !== 'string' ||
    !SPEECH_LOCALE_PATTERN.test(value.speechLocale)
  ) {
    throw new Error(`Invalid language pack metadata for ${expectedCode}`)
  }
  return { code: expectedCode, speechLocale: value.speechLocale }
}

export async function loadLanguagePack(langCode: string): Promise<LanguagePack> {
  const code = validLanguageCode(langCode) ? langCode : 'english'
  let buffer: ArrayBuffer
  try {
    buffer = await loadBinary(`lang/${code}/pack.json`)
  } catch (error) {
    if (code !== 'english') return loadLanguagePack('english')
    throw error
  }
  const content = new TextDecoder().decode(buffer)
  if (/^\s*<(?:!doctype\s+html|html\b)/i.test(content)) {
    if (code !== 'english') return loadLanguagePack('english')
    throw new Error('Missing English language pack metadata')
  }
  return validateLanguagePack(JSON.parse(content) as unknown, code)
}

export function resolveMediaPath(langCode: string, mediaPath: string): string {
  if (!validLanguageCode(langCode)) throw new Error('Invalid language code')
  if (
    typeof mediaPath !== 'string' ||
    mediaPath.length === 0 ||
    mediaPath.startsWith('/') ||
    mediaPath.includes('\\') ||
    mediaPath.includes('?') ||
    mediaPath.includes('#') ||
    /^[a-z][a-z0-9+.-]*:/i.test(mediaPath) ||
    /%(?:2f|5c)/i.test(mediaPath)
  ) {
    throw new Error(`Invalid media path: ${mediaPath}`)
  }

  let decodedPath: string
  try {
    decodedPath = decodeURIComponent(mediaPath)
  } catch {
    throw new Error(`Invalid media path: ${mediaPath}`)
  }
  const segments = decodedPath.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error(`Invalid media path: ${mediaPath}`)
  }
  if (segments[0] === 'lang') {
    if (segments[1] !== langCode || segments.length < 3) {
      throw new Error(`Invalid media path: ${mediaPath}`)
    }
    return mediaPath
  }
  return `lang/${langCode}/${mediaPath}`
}

// Mirrors the CSS clamp() used for .match-object sizing, so drag-clamp math always
// matches the object's actual rendered footprint at any board scale.
export function boardObjectSize(scale: number, maxSize = BOARD_OBJECT_SIZE): number {
  return Math.min(maxSize, Math.max(BOARD_OBJECT_MIN_SIZE, maxSize * scale))
}

export function wordFontSize(width: number, targetLength: number, height: number): number {
  const fit = (width - WORD_INSET) / (Math.max(1, targetLength) * WORD_CHAR_WIDTH)
  return Math.max(MIN_WORD_FONT_SIZE, Math.min(54, height * 0.5, fit))
}

export function boardObjectWidth(
  item: BoardObject,
  objects: BoardObject[],
  scale: number,
  maxSize = BOARD_OBJECT_SIZE,
  pxPerUnit?: number,
): number {
  const size = boardObjectSize(scale, maxSize)
  if (item.type === 'audio' || item.image) return size

  const scaleFactor = pxPerUnit ?? size / maxSize
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

export function boardScale(width: number, height: number, hasImages: boolean): number {
  const scale = Math.min(width / BOARD_WIDTH, height / BOARD_HEIGHT, 1)
  if (!hasImages || height <= width) return scale
  // Portrait boards have spare height, so image cards grow until a combined pair fills half the width.
  const pairFit = (width / 2 - DIVIDER_CLEARANCE) / 2 / BOARD_IMAGE_OBJECT_SIZE
  return Math.min(height / BOARD_HEIGHT, 1, Math.max(scale, pairFit))
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

export async function loadTrial(url: string, langCode?: string): Promise<Trial> {
  const buffer = await loadBinary(url)
  const trial = validateTrial(JSON.parse(new TextDecoder().decode(buffer)) as unknown)
  if (!langCode) return trial
  const resolveObjects = (items: TrialObject[]) => items.map((item) => ({
    ...item,
    ...(item.image ? { image: resolveMediaPath(langCode, item.image) } : {}),
    ...(item.audio ? { audio: resolveMediaPath(langCode, item.audio) } : {}),
  }))
  return { ...trial, left: resolveObjects(trial.left), right: resolveObjects(trial.right) }
}

export function trialNumberFromSearch(search: string): number | null {
  const value = new URLSearchParams(search).get('trial') ?? ''
  return /^[1-9]\d*$/.test(value) ? Number(value) : null
}

export function trialPath(langCode: string, trialNum: number): string {
  if (!validLanguageCode(langCode) || !Number.isInteger(trialNum) || trialNum < 1) {
    throw new Error('Invalid trial path')
  }
  return `lang/${langCode}/trials/trial-${trialNum}.json`
}

export function trialIndexPath(langCode: string): string {
  if (!validLanguageCode(langCode)) throw new Error('Invalid language code')
  return `lang/${langCode}/trials/index.json`
}

export function validateTrialIndex(value: unknown): number[] {
  const trials = isObject(value) ? value.trials : undefined
  if (
    !Array.isArray(trials) ||
    trials.length === 0 ||
    !trials.every((num) => typeof num === 'number' && Number.isInteger(num) && num > 0)
  ) {
    throw new Error('Trial index must list positive trial numbers')
  }
  return [...new Set(trials as number[])].sort((a, b) => a - b)
}

export async function loadTrialIndex(url: string): Promise<number[]> {
  const buffer = await loadBinary(url)
  return validateTrialIndex(JSON.parse(new TextDecoder().decode(buffer)) as unknown)
}

export function pageCount(trialCount: number): number {
  return Math.max(1, Math.ceil(trialCount / TRIALS_PER_PAGE))
}

export function trialsForPage(trials: number[], page: number): number[] {
  return trials.slice(page * TRIALS_PER_PAGE, (page + 1) * TRIALS_PER_PAGE)
}

export function nextTrialNumber(trials: number[], trialNum: number): number | null {
  return trials[trials.indexOf(trialNum) + 1] ?? null
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

const TILE_GAP = 8
const SEARCH_STEP = 10

type Rect = { x: number; y: number; w: number; h: number }

export interface LayoutMetrics {
  scale: number
  maxSize: number
  // Design units per rendered pixel on each axis.
  unitsPerPx: [number, number]
}

function tileSize(item: BoardObject, objects: BoardObject[], metrics: LayoutMetrics): { w: number; h: number; combined: boolean } {
  const { scale, maxSize, unitsPerPx: [ux, uy] } = metrics
  const merged = objects.find((other) => other.mergedInto === item.object_id)
  const width = boardObjectWidth(item, objects, scale, maxSize, 1 / ux) + (merged ? boardObjectWidth(merged, objects, scale, maxSize, 1 / ux) : 0)
  return { w: width * ux, h: boardObjectSize(scale, maxSize) * uy, combined: merged !== undefined }
}

export function fitsHalf(widthUnits: number): boolean {
  return widthUnits <= BOARD_CENTER - DIVIDER_CLEARANCE
}

// Mirrors the CSS clamp that keeps a combined tile inside the half of the board it sits in.
function tileCenterX(item: BoardObject, w: number, combined: boolean): number {
  if (!combined) return item.x
  const [min, max] = !fitsHalf(w) ? [w / 2, BOARD_WIDTH - w / 2]
    : item.x < BOARD_CENTER ? [w / 2, BOARD_CENTER - w / 2] : [BOARD_CENTER + w / 2, BOARD_WIDTH - w / 2]
  return Math.max(min, Math.min(item.x, max))
}

function overlaps(a: Rect, b: Rect, gap = 0): boolean {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 + gap && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + gap
}

function fitsBoard(rect: Rect): boolean {
  const [left, right] = [rect.x - rect.w / 2, rect.x + rect.w / 2]
  const epsilon = 0.5
  return left >= -epsilon && right <= BOARD_WIDTH + epsilon
    && rect.y - rect.h / 2 >= -epsilon && rect.y + rect.h / 2 <= BOARD_HEIGHT + epsilon
    && (!fitsHalf(rect.w) || right <= BOARD_CENTER + epsilon || left >= BOARD_CENTER - epsilon)
}

function axisCandidates(min: number, max: number, edges: number[]): number[] {
  const values = [min, max, ...edges.filter((value) => value >= min && value <= max)]
  for (let value = min + SEARCH_STEP; value < max; value += SEARCH_STEP) values.push(value)
  return values
}

// Prefers the tile's own half; the other half is a last resort when its own half is full.
function freeSpot(rect: Rect, side: Side, blockers: Rect[], preferred: Rect[]): [number, number] | null {
  const halfW = rect.w / 2
  const halfH = rect.h / 2
  const gap = TILE_GAP + 0.01
  const all = [...blockers, ...preferred]
  const ys = axisCandidates(halfH, BOARD_HEIGHT - halfH, all.flatMap((b) => [b.y - (b.h + rect.h) / 2 - gap, b.y + (b.h + rect.h) / 2 + gap]))
  const sides: Side[] = side === 'left' ? ['left', 'right'] : ['right', 'left']
  for (const region of sides) {
    let [minX, maxX] = !fitsHalf(rect.w) ? [halfW, BOARD_WIDTH - halfW]
      : region === 'left'
        ? [halfW, BOARD_CENTER - DIVIDER_CLEARANCE - halfW]
        : [BOARD_CENTER + DIVIDER_CLEARANCE + halfW, BOARD_WIDTH - halfW]
    if (minX > maxX) minX = maxX = (minX + maxX) / 2
    const xs = axisCandidates(minX, maxX, all.flatMap((b) => [b.x - (b.w + rect.w) / 2 - gap, b.x + (b.w + rect.w) / 2 + gap]))
    const candidates = xs.flatMap((x) => ys.map((y): [number, number] => [x, y]))
    candidates.sort((a, b) => Math.hypot(a[0] - rect.x, a[1] - rect.y) - Math.hypot(b[0] - rect.x, b[1] - rect.y))
    for (const group of [all, blockers]) {
      const spot = candidates.find(([x, y]) => group.every((other) => !overlaps({ ...rect, x, y }, other, TILE_GAP)))
      if (spot) return spot
    }
  }
  return null
}

// Keeps the anchor in place and moves any other tile that overlaps a settled tile to the
// nearest free spot in its own region; with no anchor, solved tiles settle first.
export function resolveOverlaps(objects: BoardObject[], anchorId: string | null, metrics: LayoutMetrics): BoardObject[] {
  const tiles = objects
    .filter((item) => !item.mergedInto)
    .map((item) => {
      const { w, h, combined } = tileSize(item, objects, metrics)
      const x = tileCenterX(item, w, combined)
      const side: Side = x < BOARD_CENTER ? 'left' : 'right'
      return { id: item.object_id, solved: item.solved, side, rect: { x, y: item.y, w, h } }
    })
  type Tile = (typeof tiles)[number]
  const anchor = tiles.find((tile) => tile.id === anchorId)
  let queue = tiles
    .filter((tile) => tile !== anchor)
    .sort((a, b) => anchor
      ? Math.hypot(a.rect.x - anchor.rect.x, a.rect.y - anchor.rect.y) - Math.hypot(b.rect.x - anchor.rect.x, b.rect.y - anchor.rect.y)
      : Number(b.solved) - Number(a.solved))

  const attempt = (order: Tile[]) => {
    const settled: Rect[] = anchor ? [anchor.rect] : []
    const moves = new Map<string, [number, number]>()
    const stuck: Tile[] = []
    order.forEach((tile, index) => {
      let rect = tile.rect
      if (!fitsBoard(rect) || settled.some((other) => overlaps(rect, other))) {
        const spot = freeSpot(rect, tile.side, settled, order.slice(index + 1).map((other) => other.rect))
        if (spot) {
          rect = { ...rect, x: spot[0], y: spot[1] }
          moves.set(tile.id, spot)
        } else stuck.push(tile)
      }
      settled.push(rect)
    })
    return { moves, stuck }
  }

  // A tile that finds no room is retried earlier so the tiles around it make room instead.
  let best = attempt(queue)
  let latest = best
  for (let tries = 0; latest.stuck.length > 0 && best.stuck.length > 0 && tries < queue.length; tries += 1) {
    const [stuck] = latest.stuck
    queue = [stuck, ...queue.filter((tile) => tile !== stuck)]
    latest = attempt(queue)
    if (latest.stuck.length < best.stuck.length) best = latest
  }
  const { moves } = best
  if (moves.size === 0) return objects
  return objects.map((item) => {
    const spot = moves.get(item.object_id)
    return spot ? { ...item, x: spot[0], y: spot[1] } : item
  })
}

function progressLanguage(langCode: string): string {
  return validLanguageCode(langCode) ? langCode : 'english'
}

export function progressKey(trialNum: number, langCode = 'english'): string {
  return `ftm:lang:${progressLanguage(langCode)}:trial:${trialNum}:solved`
}

export function totalKey(trialNum: number, langCode = 'english'): string {
  return `ftm:lang:${progressLanguage(langCode)}:trial:${trialNum}:total`
}

function readProgressValue(trialNum: number, langCode: string, kind: 'solved' | 'total'): string | null {
  const code = progressLanguage(langCode)
  const scopedKey = kind === 'solved' ? progressKey(trialNum, code) : totalKey(trialNum, code)
  try {
    const scopedValue = localStorage.getItem(scopedKey)
    if (scopedValue !== null || code !== 'english') return scopedValue
    const legacyKey = `ftm:trial:${trialNum}:${kind}`
    const legacyValue = localStorage.getItem(legacyKey)
    if (legacyValue !== null) {
      localStorage.setItem(scopedKey, legacyValue)
      localStorage.removeItem(legacyKey)
    }
    return legacyValue
  } catch {
    return null
  }
}

export function readSolvedIds(trialNum: number, langCode = 'english'): Set<string> {
  try {
    const value = readProgressValue(trialNum, langCode, 'solved')
    const ids: unknown = value ? JSON.parse(value) : []
    return new Set(Array.isArray(ids) && ids.every((id) => typeof id === 'string') ? ids : [])
  } catch { return new Set() }
}

export function writeSolvedIds(trialNum: number, ids: Set<string>, langCode = 'english'): void {
  try {
    readProgressValue(trialNum, langCode, 'solved')
    localStorage.setItem(progressKey(trialNum, langCode), JSON.stringify([...ids]))
  } catch { /* restricted WebView */ }
}

// Stored while playing so the selector can mark completion without loading every trial.
export function readTrialTotal(trialNum: number, langCode = 'english'): number {
  try {
    const total = Number(readProgressValue(trialNum, langCode, 'total'))
    return Number.isInteger(total) && total > 0 ? total : 0
  } catch { return 0 }
}

export function writeTrialTotal(trialNum: number, total: number, langCode = 'english'): void {
  try {
    readProgressValue(trialNum, langCode, 'total')
    localStorage.setItem(totalKey(trialNum, langCode), String(total))
  } catch { /* restricted WebView */ }
}

export function isTrialCompleted(trialNum: number, langCode = 'english'): boolean {
  const total = readTrialTotal(trialNum, langCode)
  return total > 0 && readSolvedIds(trialNum, langCode).size >= total
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
function speak(text: string, speechLocale: string): boolean {
  try {
    if (!('speechSynthesis' in window)) return false
    const locale = speechLocale === 'english' ? 'en-GB' : speechLocale
    const requested = locale.toLowerCase()
    const voices = window.speechSynthesis.getVoices().filter((candidate) => candidate.localService)
    const voice = voices.find((candidate) => candidate.lang.toLowerCase() === requested)
      ?? voices.find((candidate) => candidate.lang.toLowerCase().startsWith(`${requested.split('-')[0]}-`))
    if (!voice) return false
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voice
    utterance.lang = voice.lang
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    return true
  } catch { return false }
}

export function playPronunciation(item: Pick<TrialObject, 'audio' | 'target'>, speechLocale: string): void {
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
  if (!speak(item.target, speechLocale)) playTone('target')
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