#!/usr/bin/env bash
# Phase 2 — generate 5 non-people banners (1920x640) with z_image_turbo.
set -euo pipefail
CLI=/opt/homebrew/bin/draw-things-cli
export DRAWTHINGS_MODELS_DIR=/Users/Maxi/Code/Models
OUT=/Users/Maxi/Code/SDCA/public/img/banners
mkdir -p "$OUT"
COMMON=(--model z_image_turbo_1.0_q8p.ckpt --no-download-missing --width 1920 --height 640 --negative-prompt "people, person, human, face, hands, crowd, text, watermark, logo, signature, blurry, low quality")

run() {
  local name="$1"; local prompt="$2"; local seed="$3"
  if [ -f "$OUT/$name.png" ]; then echo "skip $name (exists)"; return; fi
  "$CLI" generate "${COMMON[@]}" --prompt "$prompt" --seed "$seed" --output "$OUT/$name.png" >/dev/null 2>&1
  echo "done $name (seed $seed)"
}

run banner-coastline "Wide panoramic San Diego La Jolla coastline at golden hour: dramatic coastal cliffs and coves, Pacific Ocean, soft warm sunset light, palm trees, distant city skyline silhouette, clean uncluttered composition, professional landscape photography, no people, no text" 1001
run banner-temple "Elegant traditional Chinese temple roofs with upturned eaves, red and dark wood, hanging red lanterns glowing warm against a deep indigo evening sky, symmetrical composition, clean background, architectural photography, no people, no text" 1002
run banner-calligraphy "Macro still life of a traditional Chinese calligraphy brush resting on cream rice paper with one bold expressive black ink stroke and a small ink stone, soft natural window light, minimalist zen composition, shallow depth of field, no people, no text" 1003
run banner-paper-cut "Seamless decorative red Chinese paper-cut pattern texture on deep navy background: interlocking auspicious cloud and plum blossom motifs, flat vector-style, crisp edges, evenly lit, elegant and understated, no people, no text" 1004
run banner-books-ink "Still life of stacked Chinese classics books with a brush, an ink stone and a small tea cup on a dark wood table, warm side light, scholarly calm atmosphere, deep navy and red accents, clean composition, no people, no text" 1005
