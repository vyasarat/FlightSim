# Contact sheet of the art rig's renders: python3 scripts/art_sheet.py <tag> [vantage,...] [out]
import sys, os
from PIL import Image
tag = sys.argv[1]
d = os.path.join(os.path.dirname(__file__), "..", "evidence", "art", tag)
names = sys.argv[2].split(",") if len(sys.argv) > 2 and sys.argv[2] else sorted({f.rsplit("-", 1)[0] for f in os.listdir(d) if f.endswith(".png")})
out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(d, "..", "sheet-%s.jpg" % tag)
tw, th = 300, 432
sheet = Image.new("RGB", (tw * 2 * min(4, len(names)), th * ((len(names) + 3) // 4)), (20, 20, 20))
for i, n in enumerate(names):
    for j, v in enumerate(["chase", "cockpit"]):
        p = os.path.join(d, "%s-%s.png" % (n, v))
        if not os.path.exists(p): continue
        im = Image.open(p).convert("RGB").resize((tw, th))
        sheet.paste(im, (((i % 4) * 2 + j) * tw, (i // 4) * th))
sheet.save(out, quality=85)
print(out)
