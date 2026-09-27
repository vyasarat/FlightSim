"use strict";
// evidence/art/atlas{,-detail}.png (from make_atlas.py) -> cockpit/textures/*.webp.
// Lossy colour, lossless-quality alpha: the alpha is the glaze mask.
const path = require("path"), fs = require("fs");
const sharp = require(path.resolve(__dirname, "..", "node_modules", "sharp"));
for (const name of ["atlas", "atlas-detail"]) {
  const src = path.resolve(__dirname, "..", "evidence", "art", name + ".png");
  const dst = path.resolve(__dirname, "..", "cockpit", "textures", name + ".webp");
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  sharp(src).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(dst)
    .then(i => console.log("wrote", dst, (i.size / 1024).toFixed(0) + " KB"));
}
