import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const cssPath = path.join(process.cwd(), 'src', 'App.css')
const css = fs.readFileSync(cssPath, 'utf8')
// Containment must trigger on short-height (landscape phone) viewports too, not just narrow width.
const containment = css.match(/@media \(max-width: 700px\), \(max-height: 500px\) \{([\s\S]*?)\n\}/)?.[1]
const mobile = css.match(/@media \(max-width: 700px\) \{([\s\S]*)\n\}\s*$/)?.[1]

assert.ok(containment, 'short-viewport containment rules are missing')
assert.match(containment, /\.game-shell \{[\s\S]*height: 100dvh;/)
assert.match(containment, /\.game-shell \{[\s\S]*min-height: 100dvh;/)
assert.match(containment, /\.game-shell \{[\s\S]*overflow: hidden;/)
assert.match(containment, /\.play-area \{[\s\S]*flex: 1 1 auto;/)
assert.match(containment, /\.play-area \{[\s\S]*height: auto;/)
assert.match(containment, /\.play-area \{[\s\S]*min-height: 0;/)
assert.doesNotMatch(containment, /\.play-area \{[\s\S]*min-height: 520px;/)

assert.ok(mobile, 'mobile layout rules are missing')
assert.doesNotMatch(mobile, /\.match-object \{[\s\S]*width: 68px;/)

assert.match(css, /\.play-area \{[\s\S]*?display: flex;/)
assert.match(css, /\.play-area \{[\s\S]*?align-items: center;/)
assert.match(css, /\.play-area \{[\s\S]*?justify-content: center;/)
assert.match(css, /\.match-object \{[\s\S]*?width: clamp\(\s*var\(--board-object-min/)
assert.match(css, /\.match-object \{[\s\S]*?height: clamp\(\s*var\(--board-object-min/)

// TC-2.2: the combined tile keeps the single-object footprint so it cannot add overlap.
const combinedRules = [...css.matchAll(/\.is-combined[^{]*\{([^}]*)\}/g)].map((match) => match[1]).join('\n')
assert.ok(combinedRules, 'combined tile rules are missing')
assert.doesNotMatch(combinedRules, /(^|\s)(width|height):/)

// TC-5.5: reduced motion swaps the scale celebration for a non-motion one.
const reduced = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/)?.[1]
assert.ok(reduced, 'reduced-motion rules are missing')
assert.match(reduced, /\.is-celebrating \{[\s\S]*animation: match-glow/)
assert.match(reduced, /\.match-sparkles \{[\s\S]*display: none;/)

console.log('mobile layout containment: ok')
console.log('proportional object sizing: ok')
console.log('combined tile footprint and reduced motion: ok')
