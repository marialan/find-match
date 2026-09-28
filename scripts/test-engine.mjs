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

const { makeBoardObjects, playPronunciation, preloadAudio, validateTrial } = await import('../src/game.ts')

// TC-8.2: solved pairs restore as one combined tile hosted by the partner (later id).
const board = makeBoardObjects(validateTrial(trial), new Set(['left-a-lower', 'right-a-upper']))
assert.equal(board.find((item) => item.object_id === 'left-a-lower').mergedInto, 'right-a-upper')
assert.equal(board.find((item) => item.object_id === 'right-a-upper').mergedInto, undefined)
assert.equal(board.filter((item) => !item.mergedInto).length, objects.length - 1)
assert.ok(board.filter((item) => !item.solved).every((item) => !item.mergedInto))
console.log('combined tile restore: ok')

// TC-6.5 / TC-6.6 / TC-6.7: authored audio, then on-device voice in the learning language, then tone.
await preloadAudio({ trial_num: 0, left: [{ object_id: 'g', pos: [0, 0], target: 'g', pair_id: ['b'], audio: 'good.wav' }], right: [{ object_id: 'b', pos: [0, 0], target: 'b', pair_id: ['g'], audio: 'missing.wav' }] })
playPronunciation({ target: 'g', audio: 'good.wav' }, 'english')
playPronunciation({ target: 'b', audio: 'missing.wav' }, 'english')
playPronunciation({ target: 'c' }, 'english')
voices = [{ lang: 'en-US', localService: false }, { lang: 'fr-FR', localService: true }]
playPronunciation({ target: 'd' }, 'english')
assert.deepEqual(calls, ['file', 'speech:b:en-GB', 'speech:c:en-GB', 'tone'])
console.log('audio file, offline voice, tone fallback: ok')