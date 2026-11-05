"""Ellen's hand-drawn icons (Procreate, 1024 px originals in this folder) → site/drawings/,
served at https://ellenial.app/drawings/ for every Ellenial app.

Each drawing is re-centred in the same 840 px window (so the sizes Ellen drew stay relative to each
other) and saved at 512 px, big enough for any use; browsers scale it down crisply.
Dark mode (5 Nov 2026, decided with Ellen): every drawing also gets a <name>-dark.png where only the outline
(#17141F, the dark page colour) is repainted in the night token's dark value #F3EEF8. Fills stay exactly as
drawn, lines are never reshaped. Apps pick <name>.png or <name>-dark.png by theme.
Three are adjusted in code, decided with Ellen on 5 Nov 2026:
- wind: strokes thickened (13 px at 1024) so they hold at 24 px
- fog: an overlay, not a square icon; the gap between the two strokes halved
- change (thermometer): the empty glass filled with Card cream (change-original.png is as drawn)
Run from the repo root:  python3 art/drawings/build.py
"""
import json, os
import numpy as np
from PIL import Image, ImageFilter

OUTLINE, OUTLINE_DARK = (0x17, 0x14, 0x1F), (0xF3, 0xEE, 0xF8)

def dark_outline(im):
    """Repaint pixels that are the outline colour (and the anti-aliased edge around it) in the dark
    outline colour. Everything else, including fills, is left untouched."""
    a = np.asarray(im.convert("RGBA")).astype(np.float32)
    rgb = a[..., :3]
    dist = np.sqrt(((rgb - np.array(OUTLINE, dtype=np.float32)) ** 2).sum(-1))
    t = np.clip((100.0 - dist) / 60.0, 0.0, 1.0)[..., None]  # 1 = outline, 0 = fill
    rgb[:] = rgb * (1 - t) + np.array(OUTLINE_DARK, dtype=np.float32) * t
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), "RGBA")

SRC = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(SRC, "..", "..", "site", "drawings")
SIZE, WINDOW = 512, 840

# name, what it shows, where it's used — the list apps and the gallery read
DRAWINGS = [
  ("sun", "Sunny", "weather"), ("clear", "Clear night (moon)", "weather"),
  ("mix-day", "Partly cloudy, day", "weather"), ("mix-night", "Partly cloudy, night", "weather"),
  ("cloudy", "Cloudy", "weather"), ("drizzle", "Drizzle", "weather"), ("rain", "Rain", "weather"),
  ("sleet", "Sleet (snöblandat regn)", "weather"), ("snow", "Snow", "weather"),
  ("thunder", "Thunder", "weather"), ("wind", "Windy", "weather"),
  ("breeze", "Breezy (small badge in the corner of sun or cloud)", "weather"),
  ("fog", "Fog (overlay across the lower part of sun, moon or cloud; not square)", "weather"),
  ("frost", "Frost", "weather: What usually happens"), ("uv", "UV (sun in sunglasses)", "weather: What usually happens"),
  ("change", "How it's changing (thermometer)", "weather: What usually happens"),
  ("oops", "Something couldn't be reached (puzzled cloud)", "any app: error state"),
  # ellenial maps (5 Nov 2026): one per kind of place, plus facilities and the dog switch
  ("tree", "Park", "maps: urban"), ("leaf", "Nature reserve", "maps: nature"),
  ("waves", "Swimming spot", "maps: water"), ("fountain", "Square", "maps: squares"),
  ("flower", "Garden", "maps: gardens"), ("mountain", "A view (three peaks, sun behind)", "maps: view"),
  ("book", "Library", "maps: libraries"), ("wc", "Toilet", "maps: facility pin"),
  ("tap", "Water tap", "maps: facility pin"), ("paw-run", "Dog run (paw in a frame)", "maps: facility pin"),
  ("umbrella", "Shelter from rain", "maps: nearby tag"), ("pin", "Map pin (towns and areas in search)", "maps: search"),
  ("paw", "Bringing a dog? (light mode)", "maps: dog switch"), ("paw-halo", "Bringing a dog? (dark mode, cream halo)", "maps: dog switch"),
]
THICKEN = {"wind": (13, (0x7F, 0xA9, 0x8E))}

def square(im):
    x0, y0, x1, y1 = im.getchannel("A").getbbox()
    side = max(WINDOW, int(max(x1 - x0, y1 - y0) * 1.04))
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.alpha_composite(im.crop((x0, y0, x1, y1)), ((side - (x1 - x0)) // 2, (side - (y1 - y0)) // 2))
    return sq.resize((SIZE, SIZE), Image.LANCZOS)

def fog_overlay(im):
    im = im.crop(im.getchannel("A").getbbox())
    filled = [any(im.getpixel((x, y))[3] > 20 for x in range(0, im.size[0], 4)) for y in range(im.size[1])]
    gap = [y for y, f in enumerate(filled) if not f]
    if gap:
        g0, shift = gap[0], (gap[-1] - gap[0] + 1) // 2
        out = Image.new("RGBA", (im.size[0], im.size[1] - shift), (0, 0, 0, 0))
        out.alpha_composite(im.crop((0, g0, im.size[0], im.size[1])), (0, g0 - shift))
        out.alpha_composite(im.crop((0, 0, im.size[0], g0)), (0, 0))
        im = out
    return im.resize((SIZE, round(SIZE * im.size[1] / im.size[0])), Image.LANCZOS)

os.makedirs(OUT, exist_ok=True)
listing = []
for name, title, used in DRAWINGS:
    im = Image.open(os.path.join(SRC, name + ".png")).convert("RGBA")
    if name in THICKEN:
        k, rgb = THICKEN[name]
        a = im.getchannel("A").filter(ImageFilter.MaxFilter(k)).filter(ImageFilter.GaussianBlur(1.5))
        im = Image.new("RGBA", im.size, rgb + (0,)); im.putalpha(a)
    out = fog_overlay(im) if name == "fog" else square(im)
    out.save(os.path.join(OUT, name + ".png"), optimize=True)
    dark_outline(out).save(os.path.join(OUT, name + "-dark.png"), optimize=True)
    listing.append({"name": name, "file": f"https://ellenial.app/drawings/{name}.png",
                    "dark": f"https://ellenial.app/drawings/{name}-dark.png", "shows": title,
                    "usedIn": used, "width": out.size[0], "height": out.size[1]})
    print(name, out.size, os.path.getsize(os.path.join(OUT, name + ".png")), "bytes")

with open(os.path.join(OUT, "drawings.json"), "w") as f:
    json.dump({"by": "Ellen Nilsson (Ellenial), drawn in Procreate", "licence": "CC BY-NC-SA 4.0 — credit Ellen Nilsson / Ellenial, no commercial use, share remixes alike (https://creativecommons.org/licenses/by-nc-sa/4.0/)",
               "drawings": listing}, f, ensure_ascii=False, indent=1)

# A gallery page at ellenial.app/drawings: every drawing on light and dark, with its name and use.
import html
cards = "\n".join(
    f'<figure><div class="pair"><span class="light"><img src="/drawings/{d["name"]}.png" alt="" width="{d["width"]//4}" height="{d["height"]//4}"></span>'
    f'<span class="dark"><img src="/drawings/{d["name"]}-dark.png" alt="" width="{d["width"]//4}" height="{d["height"]//4}"></span></div>'
    f'<figcaption><b>{html.escape(d["name"])}</b><span>{html.escape(d["shows"])}</span><span class="used">{html.escape(d["usedIn"])}</span></figcaption></figure>'
    for d in listing)
page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Drawings · Ellenial</title><meta name="robots" content="noindex">
<style>
@font-face {{ font-family:'Fraunces'; font-weight:500; font-display:swap; src:url('/fonts/fraunces-latin-500-normal.woff2') format('woff2'); }}
@font-face {{ font-family:'DM Sans'; font-weight:400; font-display:swap; src:url('/fonts/dm-sans-latin-400-normal.woff2') format('woff2'); }}
@font-face {{ font-family:'DM Sans'; font-weight:600; font-display:swap; src:url('/fonts/dm-sans-latin-600-normal.woff2') format('woff2'); }}
:root {{ --ground:#FEF2E2; --card:#FFFBF5; --ink:#1F1A2E; --muted:#575166; --line:#EDE1D1; --night:#17141F; --night-card:#221E2C; }}
@media (prefers-color-scheme: dark) {{ :root {{ --ground:#17141F; --card:#221E2C; --ink:#F3EEF8; --muted:#C2BACF; --line:#332D40; }} }}
* {{ box-sizing:border-box; }}
body {{ margin:0; background:var(--ground); color:var(--ink); font:15px/1.5 'DM Sans',system-ui,sans-serif; padding:24px 16px 48px; }}
main {{ max-width:1000px; margin:0 auto; }}
h1 {{ font-family:'Fraunces',Georgia,serif; font-weight:500; font-size:30px; margin:0 0 4px; }}
p {{ margin:0 0 20px; color:var(--muted); }}
code {{ font-size:13px; }}
a {{ color:inherit; text-decoration-thickness:1px; text-underline-offset:2px; }}
.grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:12px; }}
figure {{ margin:0; background:var(--card); border:1px solid var(--line); border-radius:16px; overflow:hidden; }}
.pair {{ display:grid; grid-template-columns:1fr 1fr; }}
.pair span {{ display:flex; align-items:center; justify-content:center; min-height:120px; }}
.light {{ background:#FFFBF5; }} .dark {{ background:#221E2C; }}
.pair img {{ max-width:84px; height:auto; }}
figcaption {{ display:flex; flex-direction:column; padding:10px 12px 12px; gap:1px; }}
figcaption span {{ color:var(--muted); font-size:13px; }}
figcaption .used {{ font-size:12px; }}
</style></head>
<body><main>
<h1>Drawings</h1>
<p>Hand-drawn by Ellen in Procreate for the Ellenial apps. Each is a 512 px PNG at <code>ellenial.app/drawings/&lt;name&gt;.png</code>, with a dark-mode copy (light outline, same drawing) at <code>&lt;name&gt;-dark.png</code>; the full list for apps is <a href="drawings.json">drawings.json</a>. Licence: <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a> (credit Ellenial, not for sale, remixes shared alike). The code around them is AGPL-3.0.</p>
<div class="grid">
{cards}
</div>
</main></body></html>
"""
with open(os.path.join(OUT, "index.html"), "w") as f:
    f.write(page)
print("gallery written")
