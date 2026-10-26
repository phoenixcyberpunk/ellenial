// Builds the site into dist/: copies site/ and the self-hosted font files.
// Fonts come from npm (@fontsource) at build time, so no visitor ever loads anything from Google.
import { cpSync, mkdirSync, rmSync, copyFileSync } from 'node:fs'

const FONTS = [
  ['fraunces', [400, 600]],
  ['instrument-sans', [400, 500, 600]],
]

rmSync('dist', { recursive: true, force: true })
cpSync('site', 'dist', { recursive: true })
mkdirSync('dist/fonts', { recursive: true })
for (const [family, weights] of FONTS) {
  for (const w of weights) {
    const file = `${family}-latin-${w}-normal.woff2`
    copyFileSync(`node_modules/@fontsource/${family}/files/${file}`, `dist/fonts/${file}`)
  }
}
console.log('Built dist/')
