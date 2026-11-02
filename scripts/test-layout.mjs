import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const cssPath = path.join(process.cwd(), 'src', 'App.css')
const css = fs.readFileSync(cssPath, 'utf8')
const trialBoard = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'TrialBoard.tsx'), 'utf8')
const selector = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'TrialSelector.tsx'), 'utf8')
const trialHeader = trialBoard.match(/<header\b[\s\S]*?<\/header>/)?.[0]
assert.ok(trialHeader, 'trial header is missing')
for (const label of ['Back to trial selector', 'Reset trial', 'Next trial']) {
  assert.ok(trialHeader.includes(`aria-label="${label}"`), `${label} must be in the trial header`)
}
assert.doesNotMatch(trialBoard, /<footer\b/)
assert.ok(trialBoard.indexOf('</header>') < trialBoard.indexOf('<section className="play-area"'))
assert.match(css, /\.trial-header \{[^}]*grid-template-columns: minmax\(0, 1fr\) auto auto;/)
assert.match(css, /@media \(max-width: 520px\) \{[\s\S]*?\.trial-controls \{[^}]*grid-column: 1 \/ -1;/)
assert.match(selector, /<\/section>[\s\S]*<footer className="game-footer">[\s\S]*aria-label="Previous page"[\s\S]*aria-label="Next page"/)
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
assert.doesNotMatch(css.match(/\.word-target \{([^}]*)\}/)?.[1] ?? '', /overflow-wrap:/)
assert.match(css, /\.word-target \{[\s\S]*?font-size: var\(--word-font-size, inherit\);/)
assert.match(css, /\.word-target \{[\s\S]*?line-height: 1\.05;/)
assert.match(css, /\.object-glyph \{[\s\S]*?font-size: clamp\(20px, calc\(var\(--object-size, 176px\) \* 0\.68\), 72px\);/)
assert.doesNotMatch(css.match(/\.play-area \{([^}]*)\}/)?.[1] ?? '', /max-width:/)
assert.match(css, /\.object-image \{[\s\S]*?width: 94%;[\s\S]*?height: 94%;[\s\S]*?object-fit: contain;[\s\S]*?background: #fff;/)

const combinedRules = [...css.matchAll(/\.is-combined[^{]*\{([^}]*)\}/g)].map((match) => match[1]).join('\n')
assert.ok(combinedRules, 'combined tile rules are missing')
assert.match(combinedRules, /width: var\(--combined-width, calc\(var\(--object-size\) \* 2\)\);/)
assert.match(combinedRules, /grid-template-columns:[\s\S]*?minmax\(0, calc\(var\(--combined-first-width, 50%\) - 2px\)\)[\s\S]*?minmax\(0, calc\(var\(--combined-second-width, 50%\) - 2px\)\);/)
assert.match(css, /\.is-combined \.glyph-part \{[\s\S]*?overflow: hidden;/)
assert.match(css, /\.is-combined \.glyph-part\.left \{[\s\S]*?border-radius:/)
assert.match(css, /\.is-combined \.glyph-part\.right \{[\s\S]*?border-radius:/)
assert.match(css, /\.match-object\.has-image:not\(\.is-combined\) \.object-glyph \{\s*background: #fff;/)
assert.match(css, /\.is-combined \.object-glyph \{[\s\S]*?background: transparent;/)
assert.match(css, /\.is-combined \.glyph-part\.left:not\(\.has-image\) \{\s*background: #f4bf5f;/)
assert.match(css, /\.is-combined \.glyph-part\.right:not\(\.has-image\) \{\s*background: #70a899;/)
assert.match(css, /\.is-combined \.glyph-part\.has-image \{\s*background: #fff;/)
assert.doesNotMatch(combinedRules, /font-size:/)
assert.match(css, /\.is-combined \.glyph-part \{\s*display: grid;[\s\S]*?place-items: center;/)
assert.match(css, /\.match-object\.is-combined\.is-celebrating \{\s*transform-origin: var\(--celebration-origin-x\) var\(--celebration-origin-y\);/)

// TC-5.5: reduced motion swaps the scale celebration for a non-motion one.
const reduced = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/)?.[1]
assert.ok(reduced, 'reduced-motion rules are missing')
assert.match(reduced, /\.is-celebrating \{[\s\S]*animation: match-glow/)
assert.match(reduced, /\.match-sparkles \{[\s\S]*display: none;/)

console.log('mobile layout containment: ok')
console.log('trial header controls and selector footer: ok')
console.log('proportional object sizing: ok')
console.log('combined tile sizing and reduced motion: ok')
