import assert from 'node:assert/strict'
import fs from 'node:fs'
import { validateTrial } from '../src/game/trials.ts'
import { isTrialCompleted, writeSolvedIds, writeTrialTotal } from '../src/game/progress.ts'
import {
  DEFAULT_REPETITIONS, isRepetitionCompleted, nextRepetitionPrompt,
  readRepetitionCounts, recordRepetition, repetitionCount, repetitionKey,
  repetitionCandidate, repetitionLayout, repetitionSignature, repetitionTotal, requiredRepetitions, writeRepetitionCounts,
} from '../src/game/repetition.ts'

const storage = new Map()
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
}
const raw = JSON.parse(fs.readFileSync(new URL('../test-trials/english/trial-1.json', import.meta.url), 'utf8'))
const trial = validateTrial(raw)
assert.equal(DEFAULT_REPETITIONS, 3)
const edgeTargets = [
  { id: 'left', x: 50, y: 100, width: 60, height: 60 },
  { id: 'right', x: 270, y: 100, width: 60, height: 60 },
]
// A clamped long card overlaps an edge target even when its center cannot reach it.
assert.equal(repetitionCandidate({ x: 118, y: 100, width: 220, height: 60 }, edgeTargets, { x: 50, y: 100 })?.id, 'left')
assert.equal(repetitionCandidate({ x: 202, y: 100, width: 220, height: 60 }, edgeTargets, { x: 270, y: 100 })?.id, 'right')
assert.equal(repetitionCandidate({ x: 50, y: 170, width: 220, height: 60 }, edgeTargets, { x: 50, y: 100 })?.id, 'left')
assert.equal(repetitionCandidate({ x: 50, y: 171, width: 220, height: 60 }, edgeTargets, { x: 50, y: 100 }), null)
assert.equal(repetitionCandidate({ x: 160, y: 250, width: 220, height: 60 }, edgeTargets, { x: 50, y: 100 }), null)
assert.equal(repetitionCandidate({ x: 200, y: 100, width: 300, height: 60 }, edgeTargets, { x: 270, y: 100 })?.id, 'right')
const threeTargets = [...edgeTargets, { id: 'center', x: 160, y: 100, width: 60, height: 60 }]
const wideCard = { x: 160, y: 100, width: 280, height: 60 }
for (const target of threeTargets) {
  assert.equal(repetitionCandidate(wideCard, threeTargets, target)?.id, target.id)
}
assert.equal(repetitionCandidate(wideCard, threeTargets, { x: 90, y: 100 })?.id, 'left')
assert.equal(repetitionCandidate(wideCard, threeTargets, { x: 230, y: 100 })?.id, 'right')
for (const [width, height, landscape] of [
  [1280, 650, true], [296, 450, false], [788, 260, true], [544, 210, true],
  [500, 500, false],
]) {
  const { target, tray } = repetitionLayout(width, height, landscape)
  assert.equal(Math.min(target.x, tray.x), 12)
  assert.equal(target.y, 12)
  assert.ok(Math.abs(width - Math.max(target.x + target.width, tray.x + tray.width) - 12) < 0.001)
  assert.ok(Math.abs(height - tray.y - tray.height - 12) < 0.001)
  if (landscape) {
    assert.equal(tray.y, target.y)
    assert.equal(tray.height, target.height)
    assert.ok(Math.abs(target.x - tray.x - tray.width - 16) < 0.001)
  } else {
    assert.equal(tray.x, target.x)
    assert.equal(tray.width, target.width)
    assert.ok(Math.abs(tray.y - target.y - target.height - 16) < 0.001)
  }
}
assert.equal(repetitionTotal(trial), trial.right.length * 3)
assert.ok(trial.right.every((target) => requiredRepetitions(trial, target) === 3))

const custom = validateTrial({
  ...raw, repetitions: 2,
  right: raw.right.map((item, index) => ({ ...item, ...(index === 0 ? { repetitions: 4 } : {}) })),
})
assert.equal(requiredRepetitions(custom, custom.right[0]), 4)
assert.equal(requiredRepetitions(custom, custom.right[1]), 2)
assert.equal(repetitionTotal(custom), 4 + (custom.right.length - 1) * 2)
for (const value of [0, -1, 1.5, '3', null, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  assert.throws(() => validateTrial({ ...raw, repetitions: value }), /positive safe integer/)
  assert.throws(() => validateTrial({ ...raw,
    right: raw.right.map((item, index) => index ? item : { ...item, repetitions: value }),
  }), /positive safe integer/)
}
assert.throws(() => validateTrial({ ...raw,
  left: raw.left.map((item, index) => index ? item : { ...item, repetitions: 2 }),
}), /Only right-side targets/)

let counts = {}
const seen = []
while (nextRepetitionPrompt(custom, counts)) {
  const prompt = nextRepetitionPrompt(custom, counts)
  const target = custom.right.find((item) => item.object_id === prompt.pair_id[0])
  const wrong = custom.right.find((item) => item.object_id !== target.object_id)
  assert.equal(recordRepetition(custom, counts, prompt, wrong), counts)
  seen.push(prompt.object_id)
  counts = recordRepetition(custom, counts, prompt, target)
  writeRepetitionCounts(custom, 'english', counts)
  assert.deepEqual(readRepetitionCounts(custom, 'english'), Object.fromEntries(custom.right.map((item) => [
    item.object_id, repetitionCount(counts, item.object_id),
  ])))
  assert.equal(isRepetitionCompleted(custom.trial_num, 'english'),
    seen.length === repetitionTotal(custom))
  assert.ok(seen.length <= repetitionTotal(custom))
}
assert.deepEqual(seen.slice(0, custom.left.length * 2),
  [...custom.left, ...custom.left].map((item) => item.object_id))
assert.equal(seen.length, repetitionTotal(custom))
assert.equal(seen.at(-1), custom.left.find((item) => item.pair_id[0] === custom.right[0].object_id).object_id)
assert.equal(repetitionCount(counts, custom.right[0].object_id), 4)
const finalPrompt = custom.left.find((item) => item.pair_id[0] === custom.right[0].object_id)
assert.deepEqual(recordRepetition(custom, counts, finalPrompt, custom.right[0]), counts)

assert.deepEqual(readRepetitionCounts(custom, 'french'), {})
assert.deepEqual(readRepetitionCounts({ ...custom, repetitions: 5 }, 'english'), {})
assert.notEqual(repetitionSignature(custom), repetitionSignature(trial))
assert.equal(isTrialCompleted(custom.trial_num, 'english'), false)
writeTrialTotal(trial.trial_num, trial.left.length * 2, 'english')
writeSolvedIds(trial.trial_num, new Set([...trial.left, ...trial.right].map((item) => item.object_id)), 'english')
writeRepetitionCounts(custom, 'english', {})
assert.equal(isRepetitionCompleted(custom.trial_num, 'english'), false)
assert.equal(isTrialCompleted(trial.trial_num, 'english'), true)

const originalWarn = console.warn
const warnings = []
console.warn = (...args) => warnings.push(args)
try {
  for (const value of ['{', '{"signature":"x","counts":[],"complete":false}',
    '{"signature":"x","counts":{"id":-1},"complete":false}']) {
    storage.set(repetitionKey(trial.trial_num, 'english'), value)
    assert.deepEqual(readRepetitionCounts(trial, 'english'), {})
  }
  const getItem = localStorage.getItem
  const setItem = localStorage.setItem
  localStorage.getItem = () => { throw new Error('storage unavailable') }
  assert.deepEqual(readRepetitionCounts(trial, 'english'), {})
  localStorage.getItem = getItem
  localStorage.setItem = () => { throw new Error('storage unavailable') }
  writeRepetitionCounts(trial, 'english', {})
  localStorage.setItem = setItem
  assert.equal(warnings.length, 5)
} finally {
  console.warn = originalWarn
}

console.log('repetition configuration, scheduling, exact completion, storage isolation and failures: ok')
