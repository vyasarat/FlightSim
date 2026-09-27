# Build the art sprint's before/after page from evidence/art/ (renders, perf.json,
# the atlas previews).   python3 scripts/art_report.py <out.html>
import base64, io, json, os, sys, html
from PIL import Image

ART = os.path.join(os.path.dirname(__file__), "..", "evidence", "art")
OUT = sys.argv[1]
perf = json.load(open(os.path.join(ART, "perf.json")))

VANTAGES = [
    ("ny-runway", "New York from the runway", "South end of the NY runway, looking down it across the harbour. The takeoff spot at the north end sits 2.5 km from the city, which is past the fog, and the runway lock always points the plane down the runway."),
    ("ny-300m", "New York from 300 m", "Level at 300 m, about a kilometre out, pitched 8° down."),
    ("highway-car", "The highway from the car", "The SUV 24 s up the motorway from the NY spawn, stopped."),
    ("tunnel-portal", "The tunnel portal", "The SUV 260 m short of the first portal ahead."),
    ("harbour", "The harbour", "The speedboat in the basin, facing the container terminal."),
    ("carrier", "The carrier", "The jet 480 m off the carrier's quarter at 150 m."),
    ("mars-base", "Mars base", "The rover driven 3 s out from the starship."),
    ("demolition", "The demolition block", "Level at 110 m, 420 m from the condemned block."),
    ("ca-300m", "California from 300 m (extra)", "Not one of the eight. Added because no other vantage shows the new California city."),
]


def img(path, w=410, q=80):
    im = Image.open(path).convert("RGB")
    h = round(im.height * w / im.width)
    im = im.resize((w, h), Image.LANCZOS)
    b = io.BytesIO()
    im.save(b, "JPEG", quality=q, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()


def delta(a, b, unit="", pct=True):
    d = b - a
    s = f"{'+' if d >= 0 else '−'}{abs(d):,.{1 if isinstance(d, float) and unit == ' ms' else 0}f}{unit}"
    if pct and a:
        s += f" ({'+' if d >= 0 else '−'}{abs(d) / a * 100:.0f}%)"
    return s


def cell(v):
    return f"{v:,}" if isinstance(v, int) else f"{v}"


sections = []
rows = []
for key, title, note in VANTAGES:
    P = perf["vantages"].get(key)
    if not P:
        continue
    pairs = []
    for view in ("chase", "cockpit"):
        b, a = P[view]["before"], P[view]["after"]
        pairs.append(f"""
      <figure class="pair">
        <div class="shots">
          <div class="shot"><img src="{img(os.path.join(ART, 'before', f'{key}-{view}.png'))}" alt="{html.escape(title)}, {view} view, before" loading="lazy"><span class="tag">before</span></div>
          <div class="shot"><img src="{img(os.path.join(ART, 'after', f'{key}-{view}.png'))}" alt="{html.escape(title)}, {view} view, after" loading="lazy"><span class="tag after">after</span></div>
        </div>
        <figcaption>
          <span class="view">{view}</span>
          <dl>
            <div><dt>draw calls</dt><dd>{b['calls']:,} → <b>{a['calls']:,}</b> <i>{delta(b['calls'], a['calls'])}</i></dd></div>
            <div><dt>triangles</dt><dd>{b['tris']:,} → <b>{a['tris']:,}</b> <i>{delta(b['tris'], a['tris'])}</i></dd></div>
            <div><dt>frame (SwiftShader)</dt><dd>{b['frameMs']} → <b>{a['frameMs']} ms</b> <i>{delta(b['frameMs'], a['frameMs'], ' ms')}</i></dd></div>
          </dl>
        </figcaption>
      </figure>""")
        rows.append(f"<tr><td>{html.escape(title)}</td><td>{view}</td><td>{b['calls']:,}</td><td>{a['calls']:,}</td><td>{b['tris']:,}</td><td>{a['tris']:,}</td><td>{b['frameMs']}</td><td>{a['frameMs']}</td><td>{delta(b['frameMs'], a['frameMs'], '', True).split(' ')[-1].strip('()')}</td></tr>")
    sections.append(f"""
  <section class="vantage" id="{key}">
    <h3>{html.escape(title)}</h3>
    <p class="how">{html.escape(note)}</p>
    <div class="pairs">{''.join(pairs)}</div>
  </section>""")

atlas = img(os.path.join(ART, "atlas2-preview.jpg"), 1000, 85)
extra = json.load(open(os.path.join(ART, "extra.json"))) if os.path.exists(os.path.join(ART, "extra.json")) else {}

page = f"""<title>Little Pilot Textures II</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root {{
  --bg: #f3f5f8; --panel: #ffffff; --ink: #1f2328; --muted: #5b6573; --line: #d9dee6;
  --sky: #2f74b8; --gold: #b8860b; --flag: #ffd23e; --good: #2e8b57; --warn: #b5522e;
  --shadow: 0 1px 2px rgba(31,35,40,.06), 0 4px 16px rgba(31,35,40,.06);
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    color-scheme: dark;
    --bg: #12161b; --panel: #1b2027; --ink: #e8ecf1; --muted: #9aa5b3; --line: #2c333d;
    --sky: #6fa7d9; --gold: #e0b64a; --flag: #ffd23e; --good: #5fc38a; --warn: #e08a62;
    --shadow: none;
  }}
}}
:root[data-theme="dark"] {{
  color-scheme: dark;
  --bg: #12161b; --panel: #1b2027; --ink: #e8ecf1; --muted: #9aa5b3; --line: #2c333d;
  --sky: #6fa7d9; --gold: #e0b64a; --flag: #ffd23e; --good: #5fc38a; --warn: #e08a62;
  --shadow: none;
}}
body {{ background: var(--bg); color: var(--ink); font: 15px/1.55 "IBM Plex Sans", system-ui, sans-serif; }}
.wrap {{ max-width: 1120px; margin: 0 auto; padding-inline: 20px; padding-block: 28px 64px; }}
h1, h2, h3 {{ font-family: "Fredoka", "IBM Plex Sans", system-ui, sans-serif; font-weight: 600; text-wrap: balance; margin: 0; }}
h1 {{ font-size: clamp(30px, 5vw, 44px); line-height: 1.1; }}
h2 {{ font-size: 26px; margin-top: 48px; }}
h3 {{ font-size: 21px; }}
p {{ max-width: 68ch; margin: 0; }}
.lede {{ color: var(--muted); margin-top: 10px; }}
.mono, td, dd i, .tag {{ font-family: "IBM Plex Mono", ui-monospace, monospace; font-variant-numeric: tabular-nums; }}
.verdicts {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; margin-top: 24px; }}
.v {{ background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; display: grid; gap: 6px; align-content: start; }}
.v b {{ font-family: "Fredoka", sans-serif; font-size: 17px; font-weight: 600; }}
.v .chip {{ justify-self: start; font: 500 11px/1 "IBM Plex Mono", monospace; letter-spacing: .06em; text-transform: uppercase; padding: 5px 7px; border-radius: 5px; }}
.chip.ship {{ background: color-mix(in srgb, var(--good) 16%, transparent); color: var(--good); }}
.chip.no {{ background: color-mix(in srgb, var(--warn) 16%, transparent); color: var(--warn); }}
.v p {{ color: var(--muted); font-size: 14px; }}
.note {{ margin-top: 18px; padding: 12px 16px; border-left: 3px solid var(--flag); background: var(--panel); border-radius: 0 8px 8px 0; font-size: 14px; }}
.note p + p {{ margin-top: 6px; }}
.vantage {{ margin-top: 40px; display: grid; gap: 8px; }}
.how {{ color: var(--muted); font-size: 14px; }}
.pairs {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 500px), 1fr)); gap: 18px; margin-top: 6px; }}
.pair {{ margin: 0; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 10px; box-shadow: var(--shadow); display: grid; gap: 10px; }}
.shots {{ display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }}
.shot {{ position: relative; }}
.shot img {{ display: block; width: 100%; height: auto; border-radius: 7px; }}
.tag {{ position: absolute; left: 6px; top: 6px; font-size: 11px; letter-spacing: .05em; text-transform: uppercase; background: rgba(20,24,29,.72); color: #fff; padding: 3px 6px; border-radius: 4px; }}
.tag.after {{ background: var(--sky); }}
figcaption {{ display: grid; gap: 4px; }}
.view {{ font: 600 12px/1 "IBM Plex Mono", monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }}
dl {{ margin: 0; display: grid; gap: 2px; }}
dl div {{ display: grid; grid-template-columns: 150px 1fr; gap: 8px; font-size: 13.5px; }}
dt {{ color: var(--muted); }}
dd {{ margin: 0; }}
dd i {{ font-style: normal; color: var(--muted); font-size: 12.5px; margin-left: 4px; }}
.tablewrap {{ overflow-x: auto; margin-top: 14px; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; }}
table {{ border-collapse: collapse; width: 100%; font-size: 13px; }}
th, td {{ padding: 7px 10px; text-align: right; border-bottom: 1px solid var(--line); white-space: nowrap; }}
th {{ font: 600 11.5px/1.3 "IBM Plex Sans", sans-serif; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }}
th:first-child, td:first-child, th:nth-child(2), td:nth-child(2) {{ text-align: left; }}
tr:last-child td {{ border-bottom: 0; }}
.figure {{ margin-top: 14px; display: grid; gap: 8px; }}
.figure img {{ border-radius: 10px; border: 1px solid var(--line); max-width: 100%; height: auto; }}
.cap {{ color: var(--muted); font-size: 13.5px; }}
.two {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 18px; align-items: start; margin-top: 14px; }}
ul {{ margin: 8px 0 0; padding-left: 20px; max-width: 70ch; }}
li + li {{ margin-top: 4px; }}
a {{ color: var(--sky); }}
</style>
<div class="wrap">
  <header>
    <h1>Little Pilot textures, round two</h1>
    <p class="lede">The same nine vantage points, chase and cockpit, portrait (820×1180). Each "before" is v122 as shipped (<span class="mono">9f78cdc</span>) and each "after" is round two. The numbers are for the whole frame, shadow pass included, rendered by SwiftShader (a software renderer), not an iPad. Draw calls and triangles carry over to the iPad; SwiftShader's frame time exaggerates pixel-shading cost.</p>
  </header>

  <div class="verdicts">
    <div class="v"><span class="chip ship">1 · tiling</span><b>Real-world tile sizes</b><p>Each atlas slot now declares its real size once: asphalt 8 m, a facade four 3 m bays by four 3.5 m floors, a container side 12 m. A second, finer atlas adds grain close up: brick courses at 2 m, aggregate at 2 m, corrugation at 1 m, deck grit at 1 m.</p></div>
    <div class="v"><span class="chip ship">2 · tint</span><b>Texture carries the detail</b><p>Each slot has a contrast gain, so a dark palette road still shows its grain and its paint. The motorway now carries its lanes in the texture: edge lines and a 3 m dash every 12 m. Before, it had one 9 m dash every 160 m.</p></div>
    <div class="v"><span class="chip ship">3 · ground</span><b>Grass and sand at ground level</b><p>Grass blades, sand grain and dirt at 2 m close up. From height, a second, turned read of each ground tile hides the repeat, which had begun to show as a grid.</p></div>
    <div class="v"><span class="chip ship">4 · the cube</span><b>It was a lorry</b><p>The grey cube beside the carriageway was traffic: every lorry was a bare 4.2 × 4.4 × 15 m white box, and every car a bare box too. Lorries now have a red cab, a windscreen, a container trailer and wheels. Cars have a glasshouse, wheels and one of eight palette colours. Same size as before, same single draw call each.</p></div>
  </div>

  <div class="note">
    <p><b>Also.</b> The ship's hull uses bigger plates than the carrier deck, so its plating reads from the harbour. The city streets are re-baked at the same real sizes: narrow NY streets get a double centre line, wide CA streets get lanes too.</p>
    <p><b>Logged next:</b> hands-off, at a raised speed step, the car can rear-end slower traffic in its own lane. That breaks the no-bang crossing guarantee, and it is queued as the next fix after this round.</p>
  </div>

  <h2>The eight vantage points</h2>
  {''.join(sections)}

  <h2>All frames at a glance</h2>
  <div class="tablewrap"><table>
    <thead><tr><th>vantage</th><th>view</th><th>calls before</th><th>calls after</th><th>tris before</th><th>tris after</th><th>ms before</th><th>ms after</th><th>Δ ms</th></tr></thead>
    <tbody>{''.join(rows)}</tbody>
  </table></div>
  <p class="cap" style="margin-top:8px">The two builds were timed interleaved, five frames at a time, six rounds each, in one browser. Each frame is forced to finish with a 1-pixel readback. Ms values are medians.</p>

  <h2>The two atlases</h2>
  <div class="figure"><img src="{atlas}" alt="Left: the sixteen macro tiles. Right: the sixteen detail tiles."><p class="cap">Left, the macro atlas (16 × 512 px): the layout of each surface at its real size. The road tile is one 17.5 m carriageway, 12 m long. Right, the detail atlas (16 × 256 px): brick courses, concrete, aggregate, corrugation, deck grit, grass, sand, dirt, regolith pebbles, lunar dust, gravel, stucco and steel. The detail is laid on as luminance only and fades out by 220 m. Both atlases come from <span class="mono">scripts/make_atlas.py</span>: 678 KB and 339 KB as WebP.</p></div>
</div>
"""
open(OUT, "w").write(page)
print("wrote", OUT, os.path.getsize(OUT) // 1024, "KB")
