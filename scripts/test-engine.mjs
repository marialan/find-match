import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const trialPath = path.join(root, 'test-trials', 'english', 'trial-1.json')
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
    else if (this.url === 'lang/french/trials/trial-1.json') {
      this.status = 200
      this.response = new TextEncoder().encode(JSON.stringify({ trial_num: 1,
        left: [{ object_id: 'left', pos: [190, 200], target: 'a', pair_id: ['right'] }],
        right: [{ object_id: 'right', pos: [900, 200], target: 'A', pair_id: ['left'] }],
      })).buffer
      this.onload()
    }
    else if (this.url === 'lang/french/pack.json') {
      this.status = 200
      this.response = new TextEncoder().encode('{"code":"french","speechLocale":"fr-FR"}').buffer
      this.onload()
    }
    else if (this.url === 'lang/english/pack.json') {
      this.status = 200
      this.response = new TextEncoder().encode(fs.readFileSync(path.join(root, 'public', this.url), 'utf8')).buffer
      this.onload()
    }
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
globalThis.document = {
  createElement: () => ({
    getContext: () => ({ font: '', measureText: (text) => ({ width: text.length * 70 }) }),
  }),
}

const { BOARD_OBJECT_SIZE, BOARD_OBJECT_MIN_SIZE, MIN_PREFERRED_WORD_FONT_SIZE, boardObjectSize, boardObjectWidth, boardScale, isTrialCompleted, loadLanguagePack, loadTrial, loadTrialIndex, makeBoardObjects, nearestCandidate, nextTrialNumber, pageCount, playPronunciation, preloadAudio, progressKey, readSolvedIds, resolveMediaPath, resolveOverlaps, totalKey, trialIndexPath: buildTrialIndexPath, trialsForPage, trialNumberFromSearch, trialPath: buildTrialPath, validateLanguagePack, validateTrial, validateTrialIndex, validLanguageCode, wordFontSize, writeSolvedIds, writeTrialTotal } = await import('../src/game.ts')
const { ENGINE_SLUG } = await import('../src/game/container.ts')
const { validatePacks } = await import('./validate-packs.mjs')

assert.equal(ENGINE_SLUG, 'findmatch')

// TC-1.4: type defaults to letter; unknown types are rejected.
assert.ok(validateTrial(trial).left.every((item) => item.type === 'letter'))
assert.throws(() => validateTrial({ ...trial, left: [{ ...trial.left[0], type: 'video' }, ...trial.left.slice(1)] }), /Invalid type/)
assert.throws(() => validateTrial({ trial_num: 1, left: [trial.left[0]], right: [] }), /same number of objects/)
assert.throws(() => validateTrial({ ...trial, left: [{ ...trial.left[0], pair_id: [...trial.left[0].pair_id, 'right-extra'] }, ...trial.left.slice(1)] }), /exactly one pair_id/)
assert.throws(() => validateTrial({
  trial_num: 1,
  left: [
    { object_id: 'left-a', pos: [100, 100], target: 'a', pair_id: ['right-a'] },
    { object_id: 'left-b', pos: [100, 200], target: 'b', pair_id: ['right-b'] },
  ],
  right: [
    { object_id: 'right-a', pos: [900, 100], target: 'A', pair_id: ['left-b'] },
    { object_id: 'right-b', pos: [900, 200], target: 'B', pair_id: ['left-b'] },
  ],
}), /reciprocal and cross-side/)
assert.throws(() => validateTrial({
  trial_num: 1,
  left: ['a', 'b', 'c', 'd'].map((target, index) => ({
    object_id: `left-${target}`,
    pos: [100, 100 + index * 100],
    target,
    pair_id: target === 'd' ? ['right-3', 'right-4'] : ['right-1', 'right-2'],
  })),
  right: [
    { object_id: 'right-1', pos: [900, 100], target: '1', pair_id: ['left-a', 'left-b', 'left-c'] },
    { object_id: 'right-2', pos: [900, 200], target: '2', pair_id: ['left-a', 'left-b', 'left-c'] },
    { object_id: 'right-3', pos: [900, 300], target: '3', pair_id: ['left-d'] },
    { object_id: 'right-4', pos: [900, 400], target: '4', pair_id: ['left-d'] },
  ],
}), /exactly one pair_id/)
console.log('object type validation: ok')

// TC-1.5: trial query parameter selects the trial file; anything else shows the selector.
assert.equal(trialNumberFromSearch('?trial=2'), 2)
for (const search of ['', '?trial=0', '?trial=-1', '?trial=abc', '?trial=2.5']) assert.equal(trialNumberFromSearch(search), null)
assert.equal(buildTrialPath('english', 2), 'lang/english/trials/trial-2.json')
console.log('trial selection: ok')

// TC-1.6 / TC-11.1 / TC-11.3: trial index parsing, pagination, and next-trial lookup.
const shippedIndex = JSON.parse(fs.readFileSync(path.join(root, 'public', 'lang', 'english', 'trials', 'index.json'), 'utf8'))
assert.deepEqual(validateTrialIndex(shippedIndex), shippedIndex.trials)
assert.equal(shippedIndex.trials.length, 22)
const reviewGroups = ['aeiou', 'bdfgh', 'cjklm', 'npqrs', 'tvwxyz']
let alphabet = ''
for (const trialNum of shippedIndex.trials) {
  const file = path.join(root, 'public', buildTrialPath('english', trialNum))
  assert.ok(fs.existsSync(file), `Missing trial-${trialNum}.json`)
  const shipped = validateTrial(JSON.parse(fs.readFileSync(file, 'utf8')))
  assert.equal(shipped.trial_num, trialNum)
  if (trialNum <= 10) {
    assert.ok(shipped.left.length >= 5 && shipped.left.length <= 6)
    assert.equal(shipped.left.length, shipped.right.length)
    const letters = shipped.left.map((item) => item.target)
    if (trialNum <= 5) alphabet += letters.join('')
    else {
      assert.equal(letters.join(''), reviewGroups[trialNum - 6])
      const uppercase = shipped.right.map((item) => item.target)
      assert.notDeepEqual(uppercase, [...uppercase].sort())
    }
    for (const item of shipped.left) {
      const partner = shipped.right.find((other) => other.object_id === item.pair_id[0])
      assert.equal(item.target, item.target.toLowerCase())
      assert.equal(partner?.target, item.target.toUpperCase())
      assert.ok(partner.pair_id.includes(item.object_id))
    }
  }
  for (const item of [...shipped.left, ...shipped.right]) {
    if (trialNum <= 10) {
      const letter = item.target.toUpperCase()
      const filename = `${letter}.mp3`
      assert.equal(item.audio, `lang/english/audios/letters/${filename}`)
    }
    for (const asset of [item.image, item.audio].filter(Boolean)) {
      assert.ok(fs.existsSync(path.join(root, 'public', asset)), `Missing ${asset} in trial-${trialNum}.json`)
    }
  }
}
const wordLevels = new Map(
  [...fs.readFileSync(path.join(root, 'public', 'lang', 'english', 'words.md'), 'utf8')
    .matchAll(/^\|\s*([a-z]+)\s*\|\s*(\d+)\s*\|$/gm)]
    .map(([, word, level]) => [word, Number(level)]),
)
// TC-7.4: Derive expected vocabulary from authored words and actual media,
// independently of the shipped trials so omissions cannot pass unnoticed.
const englishRoot = path.join(root, 'public', 'lang', 'english')
const recordedWords = new Map(fs.readdirSync(path.join(englishRoot, 'audios'), { recursive: true })
  .filter((file) => !file.startsWith('letters') && file.endsWith('.mp3'))
  .map((file) => [path.basename(file, '.mp3'), `lang/english/audios/${file.split(path.sep).join('/')}`]))
const realImages = new Map(fs.readdirSync(path.join(englishRoot, 'images'), { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => [path.parse(entry.name).name, `lang/english/images/${entry.name}`]))
const expectedWords = [...new Set([...wordLevels.keys(), 'bat', 'hat'])]
  .filter((word) => recordedWords.has(word))
assert.equal(expectedWords.length, 36)
const wordPairings = new Map(expectedWords.map((word) => [word, []]))
for (const trialNum of shippedIndex.trials.filter((num) => num >= 11)) {
  const shipped = validateTrial(JSON.parse(fs.readFileSync(
    path.join(root, 'public', buildTrialPath('english', trialNum)),
    'utf8',
  )))
  assert.ok(shipped.left.length >= 3 && shipped.left.length <= 4)
  assert.equal(new Set(shipped.left.map((item) => item.target)).size, shipped.left.length)
  const objectsById = new Map([...shipped.left, ...shipped.right].map((item) => [item.object_id, item]))
  for (const word of shipped.left) {
    assert.ok(wordPairings.has(word.target), `Unexpected or unrecorded word ${word.target}`)
    assert.equal(word.type, 'letter')
    assert.equal(word.image, undefined)
    assert.equal(word.audio, recordedWords.get(word.target))
    const partner = objectsById.get(word.pair_id[0])
    assert.equal(partner.target, word.target)
    assert.equal(partner.audio, word.audio)
    const pairing = partner.type === 'audio' ? 'audio' : partner.image ? 'image' : null
    assert.ok(pairing, `Missing audio or image pairing for ${word.target} in trial ${trialNum}`)
    if (pairing === 'audio') assert.equal(partner.image, undefined)
    else {
      assert.equal(partner.type, 'letter')
      assert.ok(realImages.has(word.target), `No real image for ${word.target}`)
      assert.equal(partner.image, realImages.get(word.target))
    }
    wordPairings.get(word.target).push(pairing)
  }
}
for (const [word, pairings] of wordPairings) {
  assert.deepEqual(pairings.sort(), realImages.has(word) ? ['audio', 'image'] : ['audio'],
    `Incorrect media appearances for ${word}`)
}
const expectedPairCount = expectedWords.reduce((count, word) => count + (realImages.has(word) ? 2 : 1), 0)
assert.equal(expectedPairCount, 48)
assert.equal(shippedIndex.trials.length - 10, Math.ceil(expectedPairCount / 4))
assert.deepEqual(
  fs.readdirSync(path.join(englishRoot, 'trials')).filter((file) => /^trial-\d+\.json$/.test(file)).sort(),
  shippedIndex.trials.map((num) => `trial-${num}.json`).sort(),
)
console.log(`recorded word coverage and pairings: ok (${wordPairings.size} words, ${expectedPairCount} pairs)`)
for (const num of shippedIndex.trials) {
  const content = validateTrial(JSON.parse(fs.readFileSync(path.join(englishRoot, 'trials', `trial-${num}.json`), 'utf8')))
  for (const [width, height] of [[1120, 650], [294, 460], [334, 532], [388, 788], [786, 267], [542, 212]]) {
    const maxSize = BOARD_OBJECT_SIZE
    const scale = boardScale(width, height)
    const metrics = { scale, maxSize, unitsPerPx: [1120 / width, 650 / height] }
    const solvedStates = Array.from({ length: content.left.length + 1 }, (_, count) =>
      new Set(content.left.slice(0, count).flatMap((item) => [item.object_id, item.pair_id[0]])),
    )
    for (const solved of solvedStates) {
      const all = resolveOverlaps(makeBoardObjects(content, solved), null, metrics)
      const rects = all.filter((item) => !item.mergedInto).map((item) => {
        const merged = all.find((other) => other.mergedInto === item.object_id)
        const w = boardObjectWidth(item, all, scale, maxSize, width / 1120)
          + (merged ? boardObjectWidth(merged, all, scale, maxSize, width / 1120) : 0)
        const half = w * 1120 / width / 2
        const x = merged
          ? item.x < 560 ? Math.min(Math.max(item.x, half), 560 - half)
            : Math.min(Math.max(item.x, 560 + half), 1120 - half)
          : item.x
        return { x: x * width / 1120, y: item.y * height / 650, w, h: boardObjectSize(scale, maxSize) }
      })
      const context = `trial ${num}, ${width}x${height}, ${solved.size} solved IDs`
      for (const [i, a] of rects.entries()) {
        assert.ok(a.x - a.w / 2 >= -1 && a.x + a.w / 2 <= width + 1
          && a.y - a.h / 2 >= -1 && a.y + a.h / 2 <= height + 1, `Out of bounds: ${context}`)
        assert.ok(a.x + a.w / 2 <= width / 2 + 1 || a.x - a.w / 2 >= width / 2 - 1,
          `Crosses divider: ${context}`)
        for (const b of rects.slice(i + 1)) {
          assert.ok(Math.abs(a.x - b.x) >= (a.w + b.w) / 2 - 1
            || Math.abs(a.y - b.y) >= (a.h + b.h) / 2 - 1, `Overlapping cards: ${context}`)
        }
      }
    }
  }
}
console.log('all trial idle/partial/restored layout across six board sizes: ok')
assert.equal(alphabet, 'abcdefghijklmnopqrstuvwxyz')
assert.equal(reviewGroups.join('').split('').sort().join(''), 'abcdefghijklmnopqrstuvwxyz')
const testFixtureIndex = JSON.parse(fs.readFileSync(path.join(root, 'test-trials', 'english', 'index.json'), 'utf8'))
for (const trialNum of testFixtureIndex.trials) {
  const file = path.join(root, 'test-trials', 'english', `trial-${trialNum}.json`)
  assert.ok(fs.existsSync(file), `Missing test fixture trial-${trialNum}.json`)
  const fixture = validateTrial(JSON.parse(fs.readFileSync(file, 'utf8')))
  assert.equal(fixture.trial_num, trialNum)
}
assert.deepEqual(validateTrialIndex({ trials: [3, 1, 1, 2] }), [1, 2, 3])
for (const bad of [{}, { trials: [] }, { trials: [0] }, { trials: [1.5] }, { trials: ['1'] }]) {
  assert.throws(() => validateTrialIndex(bad), /Trial index/)
}
await assert.rejects(loadTrialIndex('missing-index.json'), /XHR error/)
assert.equal(buildTrialIndexPath('english'), 'lang/english/trials/index.json')

const frenchPack = await loadLanguagePack('french')
assert.deepEqual(frenchPack, { code: 'french', speechLocale: 'fr-FR' })
assert.equal((await loadTrial(buildTrialPath('french', 1), 'french')).trial_num, 1)
assert.equal((await loadLanguagePack('missing')).code, 'english')
assert.equal((await loadLanguagePack('../english')).code, 'english')
assert.equal(validLanguageCode('french'), true)
assert.equal(validLanguageCode('a--b'), false)
assert.throws(() => validateLanguagePack({ code: 'french', speechLocale: 'invalid-locale-' }, 'french'))
assert.equal(resolveMediaPath('french', 'audios/a.wav'), 'lang/french/audios/a.wav')
assert.equal(resolveMediaPath('english', 'lang/english/audios/a.wav'), 'lang/english/audios/a.wav')
for (const bad of ['../english/a.wav', 'lang/english/a.wav', 'https://example.org/a.wav', 'a%2fb.wav', '/a.wav']) {
  assert.throws(() => resolveMediaPath('french', bad), /Invalid media path/)
}
assert.deepEqual(validatePacks(), ['english'])
const badPackRoot = fs.mkdtempSync(path.join(root, 'pack-check-'))
try {
  fs.cpSync(path.join(root, 'public', 'lang', 'english'), path.join(badPackRoot, 'english'), { recursive: true })
  const examplePack = path.join(badPackRoot, 'french')
  fs.mkdirSync(path.join(examplePack, 'trials'), { recursive: true })
  fs.writeFileSync(path.join(examplePack, 'pack.json'), '{"code":"french","speechLocale":"fr-FR"}')
  fs.writeFileSync(path.join(examplePack, 'trials', 'index.json'), '{ "trials": [1] }')
  fs.writeFileSync(path.join(examplePack, 'trials', 'trial-1.json'), JSON.stringify({ trial_num: 1,
    left: [{ object_id: 'left', pos: [190, 200], target: 'a', pair_id: ['right'] }],
    right: [{ object_id: 'right', pos: [900, 200], target: 'A', pair_id: ['left'] }],
  }))
  assert.deepEqual(validatePacks(badPackRoot), ['english', 'french'])
  fs.writeFileSync(path.join(badPackRoot, 'french', 'trials', 'index.json'), '{ "trials": [2] }')
  assert.throws(() => validatePacks(badPackRoot), /ENOENT/)
} finally { fs.rmSync(badPackRoot, { recursive: true, force: true }) }

const thirteen = Array.from({ length: 13 }, (_, index) => index + 1)
assert.equal(pageCount(thirteen.length), 2)
assert.equal(pageCount(12), 1)
assert.equal(pageCount(0), 1)
assert.deepEqual(trialsForPage(thirteen, 0), thirteen.slice(0, 12))
assert.deepEqual(trialsForPage(thirteen, 1), [13])
assert.equal(nextTrialNumber([1, 2, 3], 2), 3)
assert.equal(nextTrialNumber([1, 2, 3], 3), null)
console.log('trial index and pagination: ok')

// TC-8.3: completion is derived from the persisted solved ids and trial size.
const store = new Map()
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
}
assert.equal(isTrialCompleted(1), false)
writeTrialTotal(1, 6)
writeSolvedIds(1, new Set(['a', 'b', 'c', 'd']))
assert.equal(isTrialCompleted(1), false)
writeSolvedIds(1, new Set(['a', 'b', 'c', 'd', 'e', 'f']))
assert.equal(isTrialCompleted(1), true)
writeSolvedIds(1, new Set(['a', 'b', 'c', 'd', 'e', 'f', 'stale-id']))
assert.equal(isTrialCompleted(1), false)
writeSolvedIds(1, new Set())
assert.equal(isTrialCompleted(1), false)
assert.equal(isTrialCompleted(1, 'french'), false)
writeTrialTotal(1, 2, 'french')
writeSolvedIds(1, new Set(['fr-left', 'fr-right']), 'french')
assert.equal(isTrialCompleted(1, 'french'), true)
assert.equal(isTrialCompleted(1), false)
store.set('ftm:trial:2:solved', '["old-left","old-right"]')
store.set('ftm:trial:2:total', '2')
assert.equal(isTrialCompleted(2, 'french'), false)
assert.equal(isTrialCompleted(2), true)
assert.deepEqual([...readSolvedIds(2)], ['old-left', 'old-right'])
assert.equal(store.has('ftm:trial:2:solved'), false)
assert.equal(store.get(progressKey(2)), '["old-left","old-right"]')
assert.equal(store.get(totalKey(2)), '2')
console.log('trial completion marking: ok')

// TC-8.2: unique rhyme partners restore as three distinct solved pairs.
const rhymeTrial = validateTrial(JSON.parse(fs.readFileSync(path.join(root, 'test-trials', 'english', 'trial-9.json'), 'utf8')))
assert.ok([...rhymeTrial.left, ...rhymeTrial.right].every((item) => item.pair_id.length === 1))
const rhymeIds = new Set([...rhymeTrial.left, ...rhymeTrial.right].map((item) => item.object_id))
const restoredRhymes = makeBoardObjects(rhymeTrial, rhymeIds)
const restoredRhymePairs = restoredRhymes.filter((item) => item.side === 'left' && item.mergedInto)
assert.equal(restoredRhymePairs.length, 3)
assert.equal(new Set(restoredRhymePairs.map((item) => item.mergedInto)).size, 3)
assert.ok(restoredRhymePairs.every((item) => item.pair_id[0] === item.mergedInto))
assert.equal(restoredRhymes.filter((item) => !item.mergedInto).length, 3)
console.log('one-to-one rhyme pair restore: ok')

// TC-6.1 / TC-6.3: trial-2 pairs every audio-only object with a letter on the other side.
const trial2 = validateTrial(JSON.parse(fs.readFileSync(path.join(root, 'test-trials', 'english', 'trial-2.json'), 'utf8')))
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
const trial3 = validateTrial(JSON.parse(fs.readFileSync(path.join(root, 'test-trials', 'english', 'trial-3.json'), 'utf8')))
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
  if (word.audio) assert.ok(fs.existsSync(path.join(root, 'public', word.audio)), `Missing pronunciation ${word.audio}`)
  assert.equal(nearestCandidate({ ...wordObject, x: picture.x, y: picture.y }, trial3Objects)?.object_id, picture.object_id)
}
assert.ok(fs.existsSync(path.join(root, 'public', 'lang/english/images/hippopotamus.png')))
assert.ok(trial3Objects.filter((item) => item.target === 'hippopotamus').every((item) => !item.audio))
console.log('word-image trial and media: ok')

// TC-2.3 / TC-2.6: widen first; only region constraints reduce single-line text.
assert.equal(MIN_PREFERRED_WORD_FONT_SIZE, 20)
assert.equal(BOARD_OBJECT_MIN_SIZE, 68)
assert.equal(BOARD_OBJECT_SIZE, 176)
for (const [width, height] of [[1470, 850], [294, 460], [542, 212]]) {
  const scale = boardScale(width, height)
  const size = boardObjectSize(scale)
  for (const target of ['a', 'cat', 'elephant', 'hippopotamus']) {
    const word = { ...trial3Objects[0], target, image: undefined }
    const picture = { ...trial3Objects[1], object_id: word.pair_id[0], image: 'cat.png', target }
    const audio = { ...picture, image: undefined, type: 'audio' }
    const cardWidth = boardObjectWidth(word, [word, picture], scale, BOARD_OBJECT_SIZE, width / 1120)
    const audioWidth = boardObjectWidth(word, [word, audio], scale, BOARD_OBJECT_SIZE, width / 1120)
    assert.equal(cardWidth, audioWidth)
    assert.ok(cardWidth >= size)
    assert.ok(cardWidth + size <= width / 2)
    const font = wordFontSize(cardWidth, target, size)
    const preferred = wordFontSize(10000, target, size)
    const desiredWidth = Math.max(size, target.length * 0.7 * preferred + 14)
    assert.ok(target.length * 0.7 * font <= cardWidth - 14 + 0.01)
    assert.equal(font < preferred, cardWidth < desiredWidth)
    if (width === 1470 && target.length > 3) assert.ok(cardWidth > size)
  }
}
assert.equal(wordFontSize(176, 'a', 176), 72)
assert.equal(wordFontSize(176, 'cat', 176), 72)
assert.ok(wordFontSize(68, 'a', 68) >= 44)
assert.ok(wordFontSize(68, 'cat', 68) >= 25)
console.log('shared base sizing and single-line text fitting: ok')

// TC-2.5: the portrait growth rule is common to every object type.
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [414, 896]]) {
  const size = boardObjectSize(boardScale(w, h))
  assert.ok(size >= BOARD_OBJECT_MIN_SIZE)
  assert.ok(size > boardObjectSize(Math.min(w / 1120, h / 650)), `${w}x${h} portrait cards did not grow`)
  assert.ok(size * 2 <= w / 2, `${w}x${h} combined pair crosses the divider`)
}
assert.equal(boardScale(1118, 743), 1118 / 1120)
assert.equal(boardScale(812, 375), 375 / 650)
console.log('shared portrait sizing: ok')

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
    const w = boardObjectWidth(item, all, 1, 84)
      + (merged ? boardObjectWidth(merged, all, 1, 84) : 0)
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
playPronunciation({ target: 'g', audio: 'good.wav' }, 'en-GB')
playPronunciation({ target: 'b', audio: 'missing.wav' }, 'en-GB')
playPronunciation({ target: 'c' }, 'en-GB')
voices = [{ lang: 'fr-FR', localService: true }, { lang: 'en-US', localService: true }]
playPronunciation({ target: 'bonjour' }, 'fr-FR')
voices = [{ lang: 'en-US', localService: false }, { lang: 'fr-FR', localService: true }]
playPronunciation({ target: 'd' }, 'en-GB')
assert.deepEqual(calls, ['file', 'speech:b:en-GB', 'speech:c:en-GB', 'speech:bonjour:fr-FR', 'tone'])
console.log('audio file, offline voice, tone fallback: ok')