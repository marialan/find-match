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
assert.match(css, /\.play-area \{[^}]*z-index: 1;[^}]*overflow: visible;/)
assert.doesNotMatch(css, /\.play-area:(?:before|after)/)
assert.match(css, /\.board \{[\s\S]*?z-index: 1;/)
assert.match(css, /\.match-object \{[\s\S]*?width: var\(--object-width, var\(--object-size\)\);/)
assert.match(css, /\.match-object \{[\s\S]*?height: var\(--object-size\);/)
assert.match(css, /\.word-target \{[\s\S]*?white-space: nowrap;/)
assert.doesNotMatch(css, /\.word-target \{[^}]*overflow-wrap: anywhere;/)
assert.match(css, /\.word-target \{[\s\S]*?font-size: var\(--word-font-size, inherit\);/)
assert.match(css, /\.word-target \{[\s\S]*?line-height: 1\.5;/)

const combinedRules = [...css.matchAll(/\.is-combined[^{]*\{([^}]*)\}/g)].map((match) => match[1]).join('\n')
assert.ok(combinedRules, 'combined tile rules are missing')
assert.match(combinedRules, /width: var\(--combined-width, calc\(var\(--object-size\) \* 2\)\);/)
assert.match(combinedRules, /grid-template-columns:[\s\S]*?minmax\(0, calc\(var\(--combined-first-width, 50%\) - 2px\)\)[\s\S]*?minmax\(0, calc\(var\(--combined-second-width, 50%\) - 2px\)\);/)
assert.match(css, /\.is-combined \.glyph-part \{[\s\S]*?overflow: hidden;/)
assert.match(css, /\.is-combined \.glyph-part\.left \{[\s\S]*?border-radius:/)
assert.match(css, /\.is-combined \.glyph-part\.right \{[\s\S]*?border-radius:/)
assert.match(css, /\.match-object\.has-image:not\(\.is-combined\) \.object-glyph \{\s*background: transparent;/)
assert.match(css, /\.is-combined \.object-glyph \{[\s\S]*?background: transparent;/)
assert.match(css, /\.is-combined \.glyph-part\.left:not\(\.has-image\) \{\s*background: #f4bf5f;/)
assert.match(css, /\.is-combined \.glyph-part\.right:not\(\.has-image\) \{\s*background: #70a899;/)
assert.match(css, /\.is-combined \.glyph-part\.has-image \{\s*background: transparent;/)
assert.doesNotMatch(combinedRules, /font-size:/)
assert.match(css, /\.is-combined \.glyph-part \{\s*display: grid;[\s\S]*?place-items: center;/)
assert.match(css, /\.match-object\.is-combined\.is-celebrating \{\s*transform-origin: var\(--celebration-origin-x\) var\(--celebration-origin-y\);/)

// TC-5.5: reduced motion swaps the scale celebration for a non-motion one.
const reduced = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/)?.[1]
assert.ok(reduced, 'reduced-motion rules are missing')
assert.match(reduced, /\.is-celebrating \{[\s\S]*animation: match-glow/)
assert.match(reduced, /\.match-sparkles \{[\s\S]*display: none;/)

console.log('mobile layout containment: ok')
console.log('proportional object sizing: ok')
console.log('combined tile sizing and reduced motion: ok')
