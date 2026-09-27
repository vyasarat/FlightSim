# Build the art sprint's before/after page from evidence/art/ (renders, perf.json,
# ssao.json, the exposure sheet, the atlas).   python3 scripts/art_report.py <out.html>
import base64, io, json, os, sys, html
from PIL import Image

ART = os.path.join(os.path.dirname(__file__), "..", "evidence", "art")
OUT = sys.argv[1]
perf = json.load(open(os.path.join(ART, "perf.json")))
ssao = json.load(open(os.path.join(ART, "ssao.json")))

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

ss_rows = "".join(
    f"<tr><td>{k}</td><td>{v['plain']['frameMs']}</td><td>{v['ssao']['frameMs']}</td><td><b>+{v['ssaoPct']}%</b></td><td>{v['plain']['calls']:,} → {v['ssao']['calls']:,}</td><td>{v['aces']['frameMs']}</td><td>{'+' if v['acesPct'] >= 0 else ''}{v['acesPct']}%</td></tr>"
    for k, v in ssao["scenes"].items())

exposure = img(os.path.join(ART, "exposure-sheet.jpg"), 900, 82)
atlas = img(os.path.join(ART, "atlas-preview.jpg"), 640, 85)
ssao_shot = img(os.path.join(ART, "ssao-ny-300m.png"), 300, 80)
extra = json.load(open(os.path.join(ART, "extra.json"))) if os.path.exists(os.path.join(ART, "extra.json")) else {}

page = f"""<title>Little Pilot Art Sprint</title>
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
    <h1>Little Pilot, before and after the art sprint</h1>
    <p class="lede">Eight vantage points, chase and cockpit, portrait (820×1180). Each "before" is the current <span class="mono">main</span> build (v121) and each "after" is the art build. The numbers are for the whole frame, shadow pass included, rendered by SwiftShader (a software renderer), not an iPad. Draw calls and triangles carry over to the iPad; SwiftShader's frame time exaggerates pixel-shading cost many times over.</p>
  </header>

  <div class="verdicts">
    <div class="v"><span class="chip ship">shipped</span><b>Textures</b><p>One 2048² atlas of 16 seamless tiles, box-mapped in the shader on buildings, landmarks, roads, terrain, the tunnel, the harbour, the carrier, the rig, containers, Mars and the Moon. The palette colours are kept; the tiles only add detail.</p></div>
    <div class="v"><span class="chip ship">shipped</span><b>Two block cities</b><p>Generated in Blender: NY {extra.get('ny_buildings', '')} buildings, CA {extra.get('ca_buildings', '')}. Street grids, setbacks, rooftop detail, instanced by type, a per-building LOD at 650 m and one merged mesh beyond 1 km.</p></div>
    <div class="v"><span class="chip no">not shipped</span><b>SSAO</b><p>Adds 71–105% frame time on the heaviest scenes, far over the 10% bar, and nearly doubles draw calls. It also draws nothing useful here, because of the log depth buffer.</p></div>
    <div class="v"><span class="chip no">not shipped</span><b>ACES tone mapping</b><p>Costs almost nothing (0–2%) but doesn't look right: it bleaches this palette. The sea goes grey-teal and the red plane turns salmon. It stays behind an off switch in <span class="mono">TUNE.light.toneMap</span>.</p></div>
  </div>

  <div class="note">
    <p><b>Fog, retuned.</b> Daytime fog now runs from 950 m to 1560 m (was 700 m to 1450 m). The terrain edge is at least 1600 m out, so it stays hidden, and a city a kilometre away now reads through the haze. Shadows are unchanged. They land correctly on the textured faces, so there was nothing to retune.</p>
    <p><b>Readability.</b> Nothing he acts on is textured: reticles, pad rings, catch-zone lights, signal heads, the fire, the scoop water and the buttons all keep their flat, high-contrast materials.</p>
  </div>

  <h2>The eight vantage points</h2>
  {''.join(sections)}

  <h2>All frames at a glance</h2>
  <div class="tablewrap"><table>
    <thead><tr><th>vantage</th><th>view</th><th>calls before</th><th>calls after</th><th>tris before</th><th>tris after</th><th>ms before</th><th>ms after</th><th>Δ ms</th></tr></thead>
    <tbody>{''.join(rows)}</tbody>
  </table></div>
  <p class="cap" style="margin-top:8px">The two builds were timed interleaved, five frames at a time, six rounds each, in one browser. Each frame is forced to finish with a 1-pixel readback. Ms values are medians.</p>

  <h2>SSAO and ACES, measured</h2>
  <p class="lede">three r128's own SSAOPass (32 samples, the stock blur), fetched into the test page only and never shipped, timed interleaved against the plain frame and an ACES frame on the heaviest scenes. The measurement stops SSAO's normal pass from redrawing the shadow map, so these numbers flatter it.</p>
  <div class="tablewrap"><table>
    <thead><tr><th>scene (chase)</th><th>plain ms</th><th>SSAO ms</th><th>SSAO cost</th><th>draw calls</th><th>ACES ms</th><th>ACES cost</th></tr></thead>
    <tbody>{ss_rows}</tbody>
  </table></div>
  <div class="two">
    <div class="figure"><img src="{ssao_shot}" alt="The NY vantage rendered through SSAOPass" width="300"><p class="cap">What SSAO draws here: no visible occlusion, because the logarithmic depth buffer breaks its depth reconstruction. The composer's render target has no MSAA, so the frame also loses its anti-aliasing. Fixing both would cost more, not less.</p></div>
    <div class="figure"><p class="cap">To ship it, SSAO would have to cost under 10% of the frame on the heaviest scene. It costs 7 to 10 times that, so the "no post-processing" rule stands.</p></div>
  </div>

  <h2>ACES, at four exposures</h2>
  <div class="figure"><img src="{exposure}" alt="Three scenes with ACES off, then at exposure 1.0, 1.2 and 1.4"><p class="cap">Left to right: ACES off (shipped), then exposure 1.0, 1.2 and 1.4. Top to bottom: New York from 300 m, the harbour, the carrier. Exposure only changes the brightness; the desaturation stays at every setting. Doing ACES properly would mean moving the whole palette to a linear colour workflow and relighting it, which is a much bigger change than a switch.</p></div>

  <h2>The atlas</h2>
  <div class="two">
    <div class="figure"><img src="{atlas}" alt="The texture atlas: sixteen tiles" width="640"></div>
    <div>
      <p>Row by row: glass curtain wall, brick, concrete window grid, asphalt with lane paint; concrete, grass, dry scrub, sand; Mars regolith, lunar regolith, corrugated steel, container side; water normal map, plain asphalt, gravel roof, steel deck plate.</p>
      <ul>
        <li>Authored procedurally (periodic noise plus pattern) by <span class="mono">scripts/make_atlas.py</span>. 770 KB as WebP.</li>
        <li>Sliced into one texture array at load, so each tile repeats with real mipmaps and there is one texture bind for everything.</li>
        <li>The alpha channel marks glass. Glass reflects the sky it is under, is the only thing on a building that glints, and lights up at night.</li>
        <li>Each tile is divided by its own mean colour and multiplied by the palette colour of what it is painted on, so the art stays on the palette.</li>
      </ul>
    </div>
  </div>
</div>
"""
open(OUT, "w").write(page)
print("wrote", OUT, os.path.getsize(OUT) // 1024, "KB")
