import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const languageRoot = path.join(process.cwd(), 'public', 'lang')
const codePattern = /^[a-z][a-z0-9-]*$/
const localePattern = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function assetPath(code, value) {
  const prefix = `lang/${code}/`
  const relative = value.startsWith(prefix) ? value.slice(prefix.length) : value
  if (!relative || relative.startsWith('/') || relative.includes('\\') || /[%?#:]/.test(relative)
    || relative.split('/').some((part) => !part || part === '.' || part === '..')
    || relative.startsWith('lang/')) throw new Error(`Invalid media path: ${value}`)
  return relative
}

export function validatePacks(root = languageRoot) {
  const codes = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  if (!codes.includes('english')) throw new Error('English fallback pack is required')

  for (const code of codes) {
    if (!codePattern.test(code) || code.includes('--') || code.endsWith('-')) throw new Error(`Invalid language code: ${code}`)
    const packRoot = path.join(root, code)
    const meta = readJson(path.join(packRoot, 'pack.json'))
    if (meta.code !== code || typeof meta.speechLocale !== 'string' || !localePattern.test(meta.speechLocale)) {
      throw new Error(`Invalid pack.json for ${code}`)
    }
    const index = readJson(path.join(packRoot, 'trials', 'index.json'))
    if (!Array.isArray(index.trials) || !index.trials.length
      || index.trials.some((num) => !Number.isInteger(num) || num < 1)
      || new Set(index.trials).size !== index.trials.length) throw new Error(`Invalid trial index for ${code}`)

    for (const num of index.trials) {
      const trial = readJson(path.join(packRoot, 'trials', `trial-${num}.json`))
      if (trial.trial_num !== num || !Array.isArray(trial.left) || !Array.isArray(trial.right)) {
        throw new Error(`Invalid trial ${num} for ${code}`)
      }
      const objects = [...trial.left, ...trial.right]
      const ids = new Set(objects.map((item) => item?.object_id))
      if (ids.size !== objects.length || objects.length === 0) throw new Error(`Duplicate or empty objects in ${code} trial ${num}`)
      for (const item of objects) {
        if (typeof item.object_id !== 'string' || !item.object_id || typeof item.target !== 'string'
          || !Array.isArray(item.pos) || item.pos.length !== 2 || !item.pos.every(Number.isFinite)
          || !Array.isArray(item.pair_id) || !item.pair_id.length
          || item.pair_id.some((id) => typeof id !== 'string' || !ids.has(id))
          || (item.type !== undefined && !['letter', 'audio'].includes(item.type))) {
          throw new Error(`Invalid object in ${code} trial ${num}`)
        }
        for (const field of ['image', 'audio']) {
          if (item[field] === undefined) continue
          if (typeof item[field] !== 'string') throw new Error(`Invalid ${field} in ${code} trial ${num}`)
          const file = path.join(packRoot, assetPath(code, item[field]))
          if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`Missing ${field}: ${file}`)
        }
      }
    }
    console.log(`validated ${code}: ${index.trials.length} trials`)
  }
  return codes
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validatePacks()
}