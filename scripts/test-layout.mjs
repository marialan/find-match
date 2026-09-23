import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const cssPath = path.join(process.cwd(), 'src', 'App.css')
const css = fs.readFileSync(cssPath, 'utf8')
const mobile = css.match(/@media \(max-width: 700px\) \{([\s\S]*)\n\}\s*$/)?.[1]

assert.ok(mobile, 'mobile layout rules are missing')
assert.match(mobile, /\.game-shell \{[\s\S]*height: 100dvh;/)
assert.match(mobile, /\.game-shell \{[\s\S]*min-height: 100dvh;/)
assert.match(mobile, /\.game-shell \{[\s\S]*overflow: hidden;/)
assert.match(mobile, /\.play-area \{[\s\S]*flex: 1 1 auto;/)
assert.match(mobile, /\.play-area \{[\s\S]*height: auto;/)
assert.match(mobile, /\.play-area \{[\s\S]*min-height: 0;/)
assert.doesNotMatch(mobile, /\.play-area \{[\s\S]*min-height: 520px;/)

console.log('mobile layout containment: ok')
