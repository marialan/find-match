import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const trialPath = path.join(root, 'public', 'lang', 'english', 'trials', 'trial-1.json')
const trial = JSON.parse(fs.readFileSync(trialPath, 'utf8'))
const objects = [...trial.left, ...trial.right]
const ids = new Set(objects.map((item) => item.object_id))

assert.equal(objects.length, 6)
assert.equal(new Set(objects.map((item) => item.object_id)).size, objects.length)
for (const item of objects) {
  assert.ok(Array.isArray(item.pos) && item.pos.length === 2)
  assert.ok(item.pair_id.length > 0)
  for (const pairId of item.pair_id) assert.ok(ids.has(pairId), `Unknown pair ${pairId}`)
}

console.log('trial schema: ok')

const calls = []
class FakeAudioContext {
  state = 'running'
  currentTime = 0
  destination = {}
  decodeAudioData(data) { return data.byteLength ? Promise.resolve({ decoded: true }) : Promise.reject(new Error('bad audio')) }
  createBufferSource() { return { connect() {}, start() { calls.push('file') } } }
  createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (node) => node } }
  createOscillator() {
    return { frequency: { setValueAtTime() {} }, connect: (node) => node, start() { calls.push('tone') }, stop() {} }
  }
}
class FakeXHR {
  open(_method, url) { this.url = url }
  send() {
    if (this.url === 'good.wav') { this.status = 200; this.response = new ArrayBuffer(4); this.onload() }
    else this.onerror()
  }
}
let voices = [{ lang: 'en-US', localService: false }, { lang: 'en-GB', localService: true }]
globalThis.window = {
  AudioContext: FakeAudioContext,
  speechSynthesis: {
    getVoices: () => voices,
    cancel() {},
    speak: (utterance) => calls.push(`speech:${utterance.text}:${utterance.voice.lang}`),
  },
}
globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
globalThis.XMLHttpRequest = FakeXHR

const { MIN_WORD_FONT_SIZE, boardObjectSize, boardObjectWidth, boardScale, makeBoardObjects, nearestCandidate, playPronunciation, preloadAudio, resolveOverlaps, trialNumberFromSearch, trialPath: buildTrialPath, validateTrial, wordFontSize } = await import('../src/game.ts')

// TC-1.4: type defaults to letter; unknown types are rejected.
assert.ok(validateTrial(trial).left.every((item) => item.type === 'letter'))
assert.throws(() => validateTrial({ ...trial, left: [{ ...trial.left[0], type: 'video' }, ...trial.left.slice(1)] }), /Invalid type/)
console.log('object type validation: ok')

// TC-1.5: trial query parameter selects the trial file, falling back to 1.
assert.equal(trialNumberFromSearch('?trial=2'), 2)
for (const search of ['', '?trial=0', '?trial=-1', '?trial=abc', '?trial=2.5']) assert.equal(trialNumberFromSearch(search), 1)
assert.equal(buildTrialPath('english', 2), 'lang/english/trials/trial-2.json')
console.log('trial selection: ok')

// TC-6.1 / TC-6.3: trial-2 pairs every audio-only object with a letter on the other side.
const trial2 = validateTrial(JSON.parse(fs.readFileSync(path.join(root, 'public', 'lang', 'english', 'trials', 'trial-2.json'), 'utf8')))
const trial2Objects = [...trial2.left, ...trial2.right]
assert.ok(trial2.left.every((item) => item.type === 'audio' && item.audio))
assert.ok(trial2.right.every((item) => item.type === 'letter'))
for (const item of trial2.left) {
  const partner = trial2Objects.find((other) => other.object_id === item.pair_id[0])
  assert.equal(partner.type, 'letter')
  assert.equal(partner.target, item.target)
  assert.ok(partner.pair_id.includes(item.object_id))
  assert.ok(fs.existsSync(path.join(root, 'public', item.audio)), `Missing audio ${item.audio}`)
}
console.log('audio-only trial: ok')

// TC-7.1 / TC-7.2: trial 3 loads real word/image pairs and their language assets.
const trial3 = validateTrial(JSON.parse(fs.readFileSync(path.join(root, 'public', 'lang', 'english', 'trials', 'trial-3.json'), 'utf8')))
const trial3Objects = makeBoardObjects(trial3, new Set())
assert.equal(trial3.trial_num, 3)
assert.deepEqual(trial3.left.map((item) => item.target), ['bat', 'cat', 'hat', 'hippopotamus'])
for (const word of trial3.left) {
  const picture = trial3Objects.find((item) => item.object_id === word.pair_id[0])
  const wordObject = trial3Objects.find((item) => item.object_id === word.object_id)
  assert.ok(picture?.image, `Missing picture pair for ${word.target}`)
  assert.ok(picture.pair_id.includes(word.object_id), `Pair is not reciprocal for ${word.target}`)
  assert.equal(picture.target, word.target)
  assert.ok(fs.existsSync(path.join(root, 'public', picture.image)), `Missing image ${picture.image}`)
  assert.ok(fs.existsSync(path.join(root, 'public', word.audio)), `Missing pronunciation ${word.audio}`)
  assert.equal(nearestCandidate({ ...wordObject, x: picture.x, y: picture.y }, trial3Objects)?.object_id, picture.object_id)
}
assert.ok(fs.existsSync(path.join(root, 'public', 'lang/english/images/hippopotamus.png')))
assert.ok(fs.existsSync(path.join(root, 'public', 'lang/english/audios/hippopotamus.wav')))
console.log('word-image trial and media: ok')

// TC-2.3: long text cards grow while the combined word/image card stays in its region.
const longWordTrial = validateTrial({
  trial_num: 4,
  left: [
    { object_id: 'word-cat-short', pos: [250, 190], target: 'cat', pair_id: ['picture-cat-short'] },
    { object_id: 'word-hippopotamus', pos: [250, 460], target: 'hippopotamus', pair_id: ['picture-hippopotamus'] },
  ],
  right: [
    { object_id: 'picture-cat-short', pos: [820, 190], target: 'cat', image: 'cat.png', pair_id: ['word-cat-short'] },
    { object_id: 'picture-hippopotamus', pos: [820, 460], target: 'hippopotamus', image: 'hippopotamus.png', pair_id: ['word-hippopotamus'] },
  ],
})
const longWordObjects = makeBoardObjects(longWordTrial, new Set())
const shortWord = longWordObjects.find((item) => item.object_id === 'word-cat-short')
const longWord = longWordObjects.find((item) => item.object_id === 'word-hippopotamus')
const shortPicture = longWordObjects.find((item) => item.object_id === 'picture-cat-short')
const longPicture = longWordObjects.find((item) => item.object_id === 'picture-hippopotamus')
assert.ok(shortWord && longWord && shortPicture && longPicture)
for (const scale of [1, 0.409, 0.325]) {
  const size = boardObjectSize(scale, 176)
  const shortWidth = boardObjectWidth(shortWord, longWordObjects, scale, 176)
  const longWidth = boardObjectWidth(longWord, longWordObjects, scale, 176)
  assert.ok(longWidth > shortWidth)
  // The unsplit word at the minimum font takes priority over staying inside one region.
  const combinedWidth = longWidth + boardObjectWidth(longPicture, longWordObjects, scale, 176)
  assert.ok(combinedWidth <= Math.max(496 * size / 176, 12 * 0.62 * MIN_WORD_FONT_SIZE + 22 + size))
  assert.ok(combinedWidth <= 1120 * scale || scale < 0.2)
  const font = wordFontSize(longWidth, 12, size)
  assert.ok(font >= MIN_WORD_FONT_SIZE)
  assert.ok(12 * 0.62 * font + 22 <= longWidth + 0.01, `hippopotamus does not fit at scale ${scale}`)
  assert.equal(boardObjectWidth(longPicture, longWordObjects, scale, 176), size)
}
for (const length of [1, 3, 8, 12, 20]) {
  const width = boardObjectWidth({ ...shortWord, target: 'x'.repeat(length) }, [], 0.2, 84)
  assert.ok(wordFontSize(width, length, 56) >= MIN_WORD_FONT_SIZE)
  assert.ok(length * 0.62 * MIN_WORD_FONT_SIZE + 22 <= width + 0.01)
}
console.log('long target tile sizing: ok')

// TC-2.5: portrait image boards grow cards until a combined pair fills half the board width.
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [414, 896]]) {
  const size = boardObjectSize(boardScale(w, h, true), 176)
  assert.ok(size > boardObjectSize(boardScale(w, h, false), 176), `${w}x${h} image cards did not grow`)
  assert.ok(size * 2 <= w / 2, `${w}x${h} combined pair crosses the divider`)
}
assert.equal(boardScale(1118, 743, true), boardScale(1118, 743, false))
assert.equal(boardScale(812, 375, true), boardScale(812, 375, false))
console.log('portrait image sizing: ok')

// TC-8.2: solved pairs restore as one combined tile hosted by the partner (later id).
const board = makeBoardObjects(validateTrial(trial), new Set(['left-a-lower', 'right-a-upper']))
assert.equal(board.find((item) => item.object_id === 'left-a-lower').mergedInto, 'right-a-upper')
assert.equal(board.find((item) => item.object_id === 'right-a-upper').mergedInto, undefined)
assert.equal(board.filter((item) => !item.mergedInto).length, objects.length - 1)
assert.ok(board.filter((item) => !item.solved).every((item) => !item.mergedInto))
console.log('combined tile restore: ok')

// TC-2.4: a drop or a new combined tile pushes overlapping tiles aside without moving the anchor.
{
  const metrics = { scale: 1, maxSize: 84, unitsPerPx: [1, 1] }
  const tileRect = (item, all) => {
    const merged = all.find((other) => other.mergedInto === item.object_id)
    const w = boardObjectWidth(item, all, 1, 84) + (merged ? boardObjectWidth(merged, all, 1, 84) : 0)
    const x = merged
      ? item.x < 560 ? Math.min(Math.max(item.x, w / 2), 560 - w / 2) : Math.min(Math.max(item.x, 560 + w / 2), 1120 - w / 2)
      : item.x
    return { x, y: item.y, w, h: 84 }
  }
  const assertNoOverlap = (all) => {
    const tiles = all.filter((item) => !item.mergedInto).map((item) => ({ item, rect: tileRect(item, all) }))
    for (const [i, a] of tiles.entries()) {
      assert.ok(a.rect.x - a.rect.w / 2 >= 0 && a.rect.x + a.rect.w / 2 <= 1120, `${a.item.object_id} leaves board`)
      assert.ok(a.rect.y - a.rect.h / 2 >= 0 && a.rect.y + a.rect.h / 2 <= 650, `${a.item.object_id} leaves board`)
      for (const b of tiles.slice(i + 1)) {
        const apart = Math.abs(a.rect.x - b.rect.x) >= (a.rect.w + b.rect.w) / 2 || Math.abs(a.rect.y - b.rect.y) >= (a.rect.h + b.rect.h) / 2
        assert.ok(apart, `${a.item.object_id} overlaps ${b.item.object_id}`)
      }
    }
  }
  const start = makeBoardObjects(validateTrial(trial), new Set())
  const [first, second] = start.filter((item) => item.side === 'left')
  const dropped = start.map((item) => (item.object_id === first.object_id ? { ...item, x: second.x + 10, y: second.y + 10 } : item))
  const resolved = resolveOverlaps(dropped, first.object_id, metrics)
  const anchor = resolved.find((item) => item.object_id === first.object_id)
  assert.deepEqual([anchor.x, anchor.y], [second.x + 10, second.y + 10])
  assert.notDeepEqual(resolved.find((item) => item.object_id === second.object_id), dropped.find((item) => item.object_id === second.object_id))
  assertNoOverlap(resolved)

  const partner = start.find((item) => item.object_id === first.pair_id[0])
  const neighbour = start.find((item) => item.side === partner.side && item.object_id !== partner.object_id)
  const crowded = start.map((item) =>
    item.object_id === first.object_id ? { ...item, solved: true, mergedInto: partner.object_id, x: partner.x, y: partner.y }
      : item.object_id === partner.object_id ? { ...item, solved: true }
        : item.object_id === neighbour.object_id ? { ...item, x: partner.x + 90, y: partner.y }
          : item)
  const merged = resolveOverlaps(crowded, partner.object_id, metrics)
  assert.deepEqual(merged.find((item) => item.object_id === partner.object_id), crowded.find((item) => item.object_id === partner.object_id))
  assertNoOverlap(merged)
  assert.equal(resolveOverlaps(merged, null, metrics), merged)
}
console.log('overlap resolution: ok')

// TC-6.5 / TC-6.6 / TC-6.7: authored audio, then on-device voice in the learning language, then tone.
await preloadAudio({ trial_num: 0, left: [{ object_id: 'g', pos: [0, 0], target: 'g', pair_id: ['b'], audio: 'good.wav' }], right: [{ object_id: 'b', pos: [0, 0], target: 'b', pair_id: ['g'], audio: 'missing.wav' }] })
playPronunciation({ target: 'g', audio: 'good.wav' }, 'english')
playPronunciation({ target: 'b', audio: 'missing.wav' }, 'english')
playPronunciation({ target: 'c' }, 'english')
voices = [{ lang: 'en-US', localService: false }, { lang: 'fr-FR', localService: true }]
playPronunciation({ target: 'd' }, 'english')
assert.deepEqual(calls, ['file', 'speech:b:en-GB', 'speech:c:en-GB', 'tone'])
console.log('audio file, offline voice, tone fallback: ok')