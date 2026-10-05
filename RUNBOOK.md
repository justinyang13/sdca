# RUNBOOK — SDCA website

## Banner images (Phase 2, generated locally — NOT photos of people)

Location: `public/img/banners/*.png` (1920×640 each).
Generated with: `z_image_turbo_1.0_q8p.ckpt` via `/opt/homebrew/bin/draw-things-cli`
(`DRAWTHINGS_MODELS_DIR=/Users/Maxi/Code/Models --no-download-missing`), script
`scripts/gen-banners.sh` (idempotent — skips files that already exist).
Negative prompt (all): `people, person, human, face, hands, crowd, text, watermark, logo,
signature, blurry, low quality`.

| File | Seed | Prompt |
|---|---|---|
| `banner-coastline.png` | 1001 | Wide panoramic San Diego La Jolla coastline at golden hour: dramatic coastal cliffs and coves, Pacific Ocean, soft warm sunset light, palm trees, distant city skyline silhouette, clean uncluttered composition, professional landscape photography, no people, no text |
| `banner-temple.png` | 1002 | Elegant traditional Chinese temple roofs with upturned eaves, red and dark wood, hanging red lanterns glowing warm against a deep indigo evening sky, symmetrical composition, clean background, architectural photography, no people, no text |
| `banner-calligraphy.png` | 1003 | Macro still life of a traditional Chinese calligraphy brush resting on cream rice paper with one bold expressive black ink stroke and a small ink stone, soft natural window light, minimalist zen composition, shallow depth of field, no people, no text |
| `banner-paper-cut.png` | 1004 | Seamless decorative red Chinese paper-cut pattern texture on deep navy background: interlocking auspicious cloud and plum blossom motifs, flat vector-style, crisp edges, evenly lit, elegant and understated, no people, no text |
| `banner-books-ink.png` | 1005 | Still life of stacked Chinese classics books with a brush, an ink stone and a small tea cup on a dark wood table, warm side light, scholarly calm atmosphere, deep navy and red accents, clean composition, no people, no text |

Notes:
- Vision-reviewed (view_image) 2026-10-05: no people/faces/hands, no watermarks.
  `banner-books-ink` has small illegible spine lettering (acceptable — it's prop lettering,
  not readable text).
- Regenerate one: delete the file and re-run `scripts/gen-banners.sh`.

## Regenerating the logo kit
`python3 scripts/build-logo.py` (PNGs) · `/tmp/sdca-venv/bin/python scripts/build-logo-svg.py` (SVGs, needs PIL).

## Re-processing photos
`node scripts/process-images.js` — idempotent, re-encodes all chosen photos into
`public/img/` + rewrites `public/img/manifest.json`.
