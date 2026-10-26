# Ellenial

The code behind **[ellenial.app](https://ellenial.app)**: the library page for Ellenial, small tools that make everyday life a little easier. Free and private.

Made by Ellen, one person, with AI helping on the code.

## What every tool stands for

- Free, never paywalled. No ads, no trackers.
- Your data stays on your phone where possible; when it has to travel, it's encrypted.
- Open source when published, so you can see exactly how it works.
- Costs in the open: the receipt on the site is updated every month. Making profits will never be the goal.

## How the site works

- One static page in `site/` (HTML, one small script). No cookies, no analytics, no forms, no database.
- Fonts (Fraunces and Instrument Sans) are bundled from npm at build time and served from this site, so no third party sees visitors.
- Strict security headers in `vercel.json`.
- Hosted on Vercel: every push to `main` deploys to ellenial.app.

Build locally: `npm install && npm run build`, then open `dist/index.html`.

## Credits

- [Fraunces](https://github.com/undercasetype/Fraunces) by Undercase Type and [Instrument Sans](https://github.com/Instrument/instrument-sans) by Instrument, both under the SIL Open Font License, via [Fontsource](https://fontsource.org).

## Licence

AGPL-3.0. See `LICENSE`.
