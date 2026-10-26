// Builds the site into dist/:
// - one page per language from page/index.html + page/strings/<lang>.json (English at /, Swedish at /sv),
// - the receipt's numbers from page/receipt.json (shared, so a monthly update is one edit),
// - site/ (scripts) and the self-hosted font files.
// Fonts come from npm (@fontsource) at build time, so no visitor ever loads anything from Google.
// The build stops if any language is missing a text, so a page can never go live half translated.
import { cpSync, mkdirSync, rmSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs'

const FONTS = [
  ['fraunces', [400, 600]],
  ['instrument-sans', [400, 500, 600]],
]

// The first language is the default and lives at the root.
const LANGUAGES = [
  { lang: 'en', dir: '', locale: 'en-GB' },
  { lang: 'sv', dir: 'sv', locale: 'sv-SE' },
]

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const template = readFileSync('page/index.html', 'utf8')
const receipt = readJson('page/receipt.json')
const keysInTemplate = [...new Set([...template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))]
const automatic = new Set(['lang', 'current_en', 'current_sv'])

rmSync('dist', { recursive: true, force: true })
cpSync('site', 'dist', { recursive: true })

const problems = []
for (const { lang, dir, locale } of LANGUAGES) {
  const strings = readJson(`page/strings/${lang}.json`)
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(receipt.updated))
  const numbers = { ...receipt, updated: date }

  const values = { lang }
  for (const other of LANGUAGES) values[`current_${other.lang}`] = other.lang === lang ? 'aria-current="page"' : ''

  for (const key of keysInTemplate) {
    if (automatic.has(key)) continue
    if (typeof strings[key] !== 'string') { problems.push(`${lang}.json is missing "${key}"`); continue }
    values[key] = strings[key].replace(/\{(\w+)\}/g, (whole, name) => {
      if (!(name in numbers)) problems.push(`${lang}.json "${key}" uses {${name}}, which isn't in receipt.json`)
      return numbers[name] ?? whole
    })
  }
  for (const key of Object.keys(strings)) {
    if (!keysInTemplate.includes(key)) problems.push(`${lang}.json has "${key}", which the page doesn't use`)
  }

  const html = template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '')
  const outDir = dir ? `dist/${dir}` : 'dist'
  mkdirSync(outDir, { recursive: true })
  writeFileSync(`${outDir}/index.html`, html)
}
if (problems.length) {
  console.error('Build stopped:\n- ' + problems.join('\n- '))
  process.exit(1)
}

mkdirSync('dist/fonts', { recursive: true })
for (const [family, weights] of FONTS) {
  for (const w of weights) {
    const file = `${family}-latin-${w}-normal.woff2`
    copyFileSync(`node_modules/@fontsource/${family}/files/${file}`, `dist/fonts/${file}`)
  }
}
console.log(`Built dist/ (${LANGUAGES.map((l) => '/' + l.dir).join(', ')})`)
