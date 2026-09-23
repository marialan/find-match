import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const dist = path.join(root, 'dist')
const artifacts = path.join(root, 'artifacts')
const coreDir = path.join(artifacts, 'ftm-core')
const langDir = path.join(artifacts, 'ftm-lang-english')
fs.rmSync(artifacts, { recursive: true, force: true })
fs.mkdirSync(coreDir, { recursive: true })
fs.mkdirSync(langDir, { recursive: true })

for (const entry of fs.readdirSync(dist)) {
  if (entry === 'lang') continue
  fs.cpSync(path.join(dist, entry), path.join(coreDir, entry), { recursive: true })
}
fs.cpSync(path.join(dist, 'lang'), path.join(langDir, 'lang'), { recursive: true })

const coreZip = path.join(artifacts, 'ftm-core.zip')
const langZip = path.join(artifacts, 'ftm-lang-english.zip')
const command = `Compress-Archive -Path '${coreDir}\\*' -DestinationPath '${coreZip}' -Force; Compress-Archive -Path '${langDir}\\*' -DestinationPath '${langZip}' -Force`
execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { stdio: 'inherit' })
console.log(`created ${path.relative(root, coreZip)} and ${path.relative(root, langZip)}`)