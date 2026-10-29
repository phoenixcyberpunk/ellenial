# Ellenial

The code behind **[ellenial.app](https://ellenial.app)**: the library page for Ellenial, small tools that make everyday life a little easier. Free and private.

Made by Ellen, one person, with AI helping on the code.

## What every tool stands for

- Free, never paywalled. No ads, no trackers.
- Your data stays on your phone where possible; when it has to travel, it's encrypted.
- Open source when published, so you can see exactly how it works.
- Costs in the open: the receipt on the site is updated every month. Making profits will never be the goal.

## How the site works

- One static page, in English (`/`) and Swedish (`/sv`). No cookies, no analytics, no forms, no database.
- `page/index.html` is the layout; the words live in `page/strings/en.json` and `page/strings/sv.json`. The build writes one page per language and stops if a language is missing a text.
- The receipt's numbers and "last updated" date live once in `page/receipt.json`, shared by both languages.
- Language: an EN | SV switch in the header. Without a choice, the phone's own language setting decides (Swedish phones get `/sv`, everyone else English). This is read on the phone only (`site/lang.js`); nothing about the visitor is sent or looked up. A choice made with the switch is remembered on that phone only. A link to `/sv` always opens in Swedish.
- Fonts (Fraunces and DM Sans) are bundled from npm at build time and served from this site, so no third party sees visitors.
- Strict security headers in `vercel.json`.
- Hosted on Vercel: every push to `main` deploys to ellenial.app.

Build locally: `npm install && npm run build`, then open `dist/index.html`.

## Credits

- [Fraunces](https://github.com/undercasetype/Fraunces) by Undercase Type and [DM Sans](https://github.com/googlefonts/dm-fonts) by Colophon Foundry, both under the SIL Open Font License, via [Fontsource](https://fontsource.org).

## Licence

AGPL-3.0. See `LICENSE`.
