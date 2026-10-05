import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { validatePacks } from './validate-packs.mjs'

const root = process.cwd()
const languages = validatePacks()
const dist = path.join(root, 'dist')
const artifacts = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'artifacts')
const coreDir = path.join(artifacts, 'ftm-core')
fs.rmSync(artifacts, { recursive: true, force: true })
fs.mkdirSync(coreDir, { recursive: true })

for (const entry of fs.readdirSync(dist)) {
  if (entry === 'lang' || entry === 'images') continue
  fs.cpSync(path.join(dist, entry), path.join(coreDir, entry), { recursive: true })
}

const coreZip = path.join(artifacts, 'ftm-core.zip')
function compress(directory, destination) {
  execFileSync('tar.exe', ['-a', '-c', '-f', destination, '-C', directory, ...fs.readdirSync(directory)], { stdio: 'inherit' })
}

compress(coreDir, coreZip)
for (const code of languages) {
  const langDir = path.join(artifacts, `ftm-lang-${code}`)
  const packDir = path.join(langDir, 'lang', code)
  fs.mkdirSync(path.dirname(packDir), { recursive: true })
  fs.cpSync(path.join(dist, 'lang', code), packDir, { recursive: true })
  const langZip = path.join(artifacts, `ftm-lang-${code}.zip`)
  compress(langDir, langZip)
  console.log(`created ${path.relative(root, langZip)}`)
}
console.log(`created ${path.relative(root, coreZip)}`)