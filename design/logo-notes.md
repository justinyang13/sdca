# Logo kit — Phase 2 notes

Source: `research/assets/images/SDCALogo-original.png` (512×512, palette PNG, already
transparent background; mark color ~#0B2593). Structure (verified by flood-fill analysis):
8 opaque islands — shield **outline** (not filled), "S D C A" letters, 2 divider lines,
dragon silhouette. The mark is line-art, not a filled shield.

## Deliverables (all in the repo)

| File | What | How made |
|---|---|---|
| `public/brand/logo.png` | 1024×1024 transparent, remapped to brand navy #0B2545 | `scripts/build-logo.py` (stdlib-only PNG rewriter; keeps original alpha, recolors opaque pixels) |
| `public/brand/logo-white.png` | same, white (navy footer / hero use) | same script |
| `public/brand/og-image.png` | 1200×630, navy tile, white mark, gold hairlines | same script |
| `public/img/favicon-16/32/180/192/512.png` | favicon set (from the 180/192 originals + resized) | same script |
| `public/brand/logo-mark.svg` | vector mark: 8 paths (shield outline, S, D, C, A, 2 lines, dragon), fill #0B2545 | `scripts/build-logo-svg.py` (PIL row-contour trace) |
| `public/brand/logo-lockup.svg` | horizontal lockup: mark + 聖地牙哥中華學苑 (44px serif) + "San Diego Chinese Academy" + "Non-profit since 1988" | same script, `<text>` elements with CJK serif stack |

## Tracer notes
- `potrace` and `autotrace` are NOT installed on this Mac (`which` checked) → custom
  Python tracer per BUILD-PLAN ("if absent write a python tracer").
- Tracer = per-row opaque-interval contours (left edge top→bottom + right edge bottom→top),
  guaranteed non-self-intersecting for shapes whose horizontal cross-section is one interval.
  Emitted as integer `L` segments — small, clean, no curve fits needed.
- Verified: 8 paths ↔ 8 source islands (sizes/positions match the flood-fill report).
  Vision review (view_image) at 480 px: shield, S/D/C/A, both divider lines and dragon
  all present and recognizable; dragon slightly coarser than the original (row-level
  quantization) but same silhouette — acceptable for web use; the original 512 px PNG
  remains available for anything needing more detail.
- SVG `<text>` uses the ARCHITECTURE §2 font stacks (Noto Serif TC / Songti TC / PMingLiU);
  no external fonts, no embedded font data.

## Usage
- Header (light bg): `logo.png` (navy) — current header uses `/img/logo.png` (the original
  512 px); swap to `/brand/logo.png` when convenient (both navy).
- Footer (navy bg): `logo-white.png`.
- Favicon: `public/img/favicon-180/192/512.png` (+ 16/32).
- OG: `public/brand/og-image.png`.
- Print/large: prefer the original PNG or `logo.png` 1024 px.

## Review status
Reviewed with view_image this session: mark + letters + lines + dragon all render; og-image
clean; lockup text correct. Claude (human) final sign-off per BUILD-PLAN (Claude reviews logo
output visually before acceptance) — noted as outstanding in the phase report.
