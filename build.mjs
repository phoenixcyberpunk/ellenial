// Builds the site into dist/:
// - each page in PAGES once per language, from page/<file> + page/strings/<lang>.json (English at /, Swedish at /sv),
// - /thanks from credits.json, so the credits live in one file,
// - the receipt's numbers from page/receipt.json (shared, so a monthly update is one edit),
// - site/ (scripts) and the self-hosted font files.
// Fonts come from npm (@fontsource) at build time, so no visitor ever loads anything from Google.
// The build stops if any language is missing a text, so a page can never go live half translated.
import { cpSync, mkdirSync, rmSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs'

// The Ellenial brand type (1 Nov 2026): Fraunces for headings, DM Sans for text.
const FONTS = [
  ['fraunces', [500]],
  ['dm-sans', [400, 500, 600]],
]

// The first language is the default and lives at the root.
const LANGUAGES = [
  { lang: 'en', dir: '', locale: 'en-GB' },
  { lang: 'sv', dir: 'sv', locale: 'sv-SE' },
]

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
// Pages built from page/<file>, each once per language. `slug` is the address after the language folder.
const PAGES = [
  { file: 'index.html', slug: '' },
  { file: 'thanks.html', slug: 'thanks' },
]
// <!--include:name--> pulls in page/<name>, so both pages share one stylesheet.
const loadTemplate = (file) => readFileSync(`page/${file}`, 'utf8')
  .replace(/<!--include:([\w.-]+)-->/g, (_, name) => readFileSync(`page/${name}`, 'utf8'))
const templates = PAGES.map((p) => ({ ...p, html: loadTemplate(p.file) }))
const receipt = readJson('page/receipt.json')
const credits = readJson('credits.json')
const keysOf = (html) => [...new Set([...html.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))]
const automatic = new Set(['lang', 'current_en', 'current_sv', 'href_en', 'href_sv', 'href_home', 'href_thanks', 'credits_list'])

// The /thanks list, built from credits.json. Groups and their order; each needs a heading in the strings.
const CREDIT_GROUPS = [
  { key: 'credits_group_data', types: ['data', 'map', 'facts'] },
  { key: 'credits_group_photos', types: ['photos'] },
  { key: 'credits_group_fonts', types: ['font'] },
  { key: 'credits_group_code', types: ['code'] },
]
// App ids in credits.json → the names on the library. Cost splitting's name differs per language.
const APP_NAMES = { site: 'ellenial.app', luncheon: 'Lunch', weather: 'Weather', quiz: 'Quiz', poll: 'Poll', bingo: 'Bingo',
  maps: 'ellenial maps', 'party-games': 'Party games', gillefeeling: 'Gillefeeling', present: 'Present', split: '{split_title}' }
// Strings the credits builder uses (not in a template, but required in every language all the same).
const BUILD_KEYS = [...CREDIT_GROUPS.map((g) => g.key), 'credits_used_in', 'credits_support']
const usedKeys = new Set([...templates.flatMap((t) => keysOf(t.html)), ...BUILD_KEYS].filter((k) => !automatic.has(k)))

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const safeUrl = (u) => (/^https:\/\//.test(u) ? esc(u) : '#')

function creditsList(lang, strings) {
  const known = new Set(CREDIT_GROUPS.flatMap((g) => g.types))
  for (const c of credits.credits) if (!known.has(c.type)) problems.push(`credits.json "${c.id}" has type "${c.type}", which no group on /thanks shows`)
  return CREDIT_GROUPS.map((g) => {
    const items = credits.credits.filter((c) => g.types.includes(c.type))
    if (!items.length) return ''
    const rows = items.map((c) => {
      const apps = c.apps.map((a) => {
        if (!APP_NAMES[a]) problems.push(`credits.json "${c.id}" uses app "${a}", which has no name in build.mjs`)
        return (APP_NAMES[a] || a).replace('{split_title}', strings.split_title)
      })
      const licence = (lang !== 'en' && c[`licence_${lang}`]) || c.licence
      const support = c.support ? ` <a class="support" href="${safeUrl(c.support)}">${esc(strings.credits_support)}</a>` : ''
      return `      <li><a class="name" href="${safeUrl(c.url)}">${esc(c.name)}</a><span class="lic">${esc(licence)}</span>${support}` +
        `<p class="used">${esc(strings.credits_used_in)} ${esc(apps.join(', '))}</p></li>`
    }).join('\n')
    return `  <div class="credit-group">\n    <h2 class="serif">${esc(strings[g.key])}</h2>\n    <ul class="credits">\n${rows}\n    </ul>\n  </div>`
  }).filter(Boolean).join('\n')
}

rmSync('dist', { recursive: true, force: true })
cpSync('site', 'dist', { recursive: true })

const problems = []
for (const { lang, dir, locale } of LANGUAGES) {
  const strings = readJson(`page/strings/${lang}.json`)
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(receipt.updated))
  const numbers = { ...receipt, updated: date }
  const text = {}
  for (const key of usedKeys) {
    if (typeof strings[key] !== 'string') { problems.push(`${lang}.json is missing "${key}"`); continue }
    text[key] = strings[key].replace(/\{(\w+)\}/g, (whole, name) => {
      if (!(name in numbers)) problems.push(`${lang}.json "${key}" uses {${name}}, which isn't in receipt.json`)
      return numbers[name] ?? whole
    })
  }
  for (const key of Object.keys(strings)) {
    if (!usedKeys.has(key)) problems.push(`${lang}.json has "${key}", which no page uses`)
  }

  for (const page of templates) {
    // Each language's address for this page: English at the root, Swedish under /sv.
    const path = (l) => {
      const d = LANGUAGES.find((x) => x.lang === l).dir
      const p = '/' + [d, page.slug].filter(Boolean).join('/')
      return l === LANGUAGES[0].lang ? (p === '/' ? '/?lang=en' : `${p}?lang=en`) : p
    }
    const home = dir ? `/${dir}` : '/'
    const values = { ...text, lang, href_en: path('en'), href_sv: path('sv'), href_home: home,
      href_thanks: (dir ? `/${dir}` : '') + '/thanks' }
    for (const other of LANGUAGES) values[`current_${other.lang}`] = other.lang === lang ? 'aria-current="page"' : ''
    if (keysOf(page.html).includes('credits_list')) values.credits_list = creditsList(lang, strings)

    const html = page.html.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '')
    const outDir = dir ? `dist/${dir}` : 'dist'
    mkdirSync(outDir, { recursive: true })
    writeFileSync(`${outDir}/${page.slug || 'index'}.html`, html)
  }
}
if (problems.length) {
  console.error('Build stopped:\n- ' + [...new Set(problems)].join('\n- '))
  process.exit(1)
}

mkdirSync('dist/fonts', { recursive: true })
for (const [family, weights] of FONTS) {
  for (const w of weights) {
    const file = `${family}-latin-${w}-normal.woff2`
    copyFileSync(`node_modules/@fontsource/${family}/files/${file}`, `dist/fonts/${file}`)
  }
}
// Fraunces italic for the notes line in the shared Ellenial footer (9 Nov 2026)
copyFileSync('node_modules/@fontsource/fraunces/files/fraunces-latin-400-italic.woff2', 'dist/fonts/fraunces-latin-400-italic.woff2')
console.log(`Built dist/: ${PAGES.length} pages × ${LANGUAGES.map((l) => '/' + l.dir).join(', ')}`)
