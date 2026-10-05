#!/usr/bin/env python3
"""
Phase 2 — logo SVG (row-contour trace: left edge top→bottom + right edge bottom→top).
This is guaranteed non-self-intersecting for shapes whose horizontal cross-section
is a single interval (shield outline, dragon body, letters, lines).
Run: /tmp/sdca-venv/bin/python scripts/build-logo-svg.py  (or python3)
"""
import os
from PIL import Image
from collections import deque

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'research', 'assets', 'images', 'SDCALogo-original.png')
BRAND = os.path.join(ROOT, 'public', 'brand')
os.makedirs(BRAND, exist_ok=True)

NAVY = '#0B2545'
GOLD = '#C9A227'

def get_mask():
    img = Image.open(SRC).convert('LA')
    w, h = img.size
    px = img.load()
    return w, h, [[px[x, y][1] > 0 for x in range(w)] for y in range(h)]

def flood(w, h, mask):
    seen = [[False]*w for _ in range(h)]
    islands = []
    for y in range(h):
        for x in range(w):
            if mask[y][x] and not seen[y][x]:
                q = deque([(x, y)]); seen[y][x] = True; comp = []
                while q:
                    cx, cy = q.popleft(); comp.append((cx, cy))
                    for dx in (-1,0,1):
                        for dy in (-1,0,1):
                            if not dx and not dy: continue
                            nx, ny = cx+dx, cy+dy
                            if 0<=nx<w and 0<=ny<h and mask[ny][nx] and not seen[ny][nx]:
                                seen[ny][nx] = True; q.append((nx,ny))
                islands.append(comp)
    return islands

def row_contour(w, h, mask, comp):
    """Left edge (top→bottom) + right edge (bottom→top) of the component's rows.
    For rows where the component has gaps (holes), only the outermost edges are used.
    This works for the shield outline (a ring → left+right edges trace the ring),
    the dragon (solid → left+right trace the silhouette), and letters/lines."""
    ys = sorted(set(y for x, y in comp))
    left, right = [], []
    for y in ys:
        row = [x for x in range(w) if mask[y][x] and (x, y) in comp_set]
        if row:
            left.append((row[0], y))
            right.append((row[-1], y))
    pts = left + list(reversed(right))
    return pts

def to_path(pts):
    if len(pts) < 3: return ''
    clean = [pts[0]]
    for p in pts[1:]:
        if p != clean[-1]: clean.append(p)
    if len(clean) < 3: return ''
    # simplify: keep every Nth point to reduce size, but keep endpoints
    n = len(clean)
    step = max(1, n // 800)
    if step > 1:
        idx = list(range(0, n, step))
        if idx[-1] != n-1: idx.append(n-1)
        clean = [clean[i] for i in idx]
    return 'M' + ' L'.join(f'{x} {y}' for x, y in clean) + ' Z'

w, h, mask = get_mask()
print(f'mask {w}x{h}, opaque={sum(sum(r) for r in mask)}')
islands = flood(w, h, mask)
islands.sort(key=len, reverse=True)
print(f'{len(islands)} islands')

def classify(c):
    xs=[p[0] for p in c]; ys=[p[1] for p in c]
    bw=max(xs)-min(xs); bh=max(ys)-min(ys)
    if len(c) > 20000: return 'dragon'
    if len(c) > 4000: return 'shield'
    if bh < 20 and bw > 200: return 'line'
    if len(c) > 300: return 'letter'
    return 'other'

groups = {}
for c in islands:
    groups.setdefault(classify(c), []).append(c)
print('groups:', {k: [len(x) for x in v] for k,v in groups.items()})

def build(comps):
    out = []
    for c in comps:
        global comp_set
        comp_set = set(c)
        pts = row_contour(w, h, mask, c)
        p = to_path(pts)
        if p: out.append(p)
    return out

dragon = build(groups.get('dragon', []))
shield = build(groups.get('shield', []))
lines = build(groups.get('line', []))
letters = build(groups.get('letter', []))
print(f'paths: dragon={len(dragon)} shield={len(shield)} lines={len(lines)} letters={len(letters)}')

body = '\n'.join(f'    <path d="{p}"/>' for p in shield + lines + letters + dragon)
mark_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="SDCA shield and dragon">
  <title>SDCA — San Diego Chinese Academy</title>
  <g fill="{NAVY}">
{body}
  </g>
</svg>
'''
open(os.path.join(BRAND, 'logo-mark.svg'), 'w').write(mark_svg)
print(f'logo-mark.svg: {len(mark_svg)} bytes')

lockup_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 200" role="img" aria-label="San Diego Chinese Academy 聖地牙哥中華學苑, non-profit since 1988">
  <title>San Diego Chinese Academy 聖地牙哥中華學苑</title>
  <g transform="translate(8,8) scale(0.36)">
    <g fill="{NAVY}">
{body}
    </g>
  </g>
  <text x="200" y="76" font-family="'Noto Serif TC','Songti TC','PMingLiU',Georgia,serif" font-size="44" font-weight="700" fill="{NAVY}">聖地牙哥中華學苑</text>
  <text x="200" y="118" font-family="Georgia,'Segoe UI',sans-serif" font-size="26" font-weight="600" fill="#14213D">San Diego Chinese Academy</text>
  <text x="200" y="154" font-family="Georgia,'Segoe UI',sans-serif" font-size="17" fill="#5A6B85">Non-profit since 1988</text>
  <line x1="200" y1="170" x2="720" y2="170" stroke="{GOLD}" stroke-width="2"/>
</svg>
'''
open(os.path.join(BRAND, 'logo-lockup.svg'), 'w').write(lockup_svg)
print(f'logo-lockup.svg: {len(lockup_svg)} bytes')
