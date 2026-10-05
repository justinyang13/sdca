#!/usr/bin/env python3
"""Trace the ORIGINAL SDCA logo (blue shield+SDCA+dragon) into a clean vector mark.
Stdlib only. Usage: python3 scripts/build-logo.py  -> public/brand/logo-mark.svg (+ work/review/mask.pbm)
Pipeline: sips upscale to BMP -> threshold ink mask -> crop -> boundary-edge loop tracing -> RDP -> quadratic smoothing."""
import struct, subprocess, sys, os
SRC = 'research/assets/images/SDCALogo-original.png'
SCALE = 4
TMP = 'work/review/logo-up.bmp'
os.makedirs('work/review', exist_ok=True)
subprocess.run(['sips', '-z', str(512*SCALE), str(512*SCALE), '-s', 'format', 'bmp', SRC, '--out', TMP], check=True, capture_output=True)

def read_bmp(p):
    d = open(p, 'rb').read()
    off = struct.unpack_from('<I', d, 10)[0]
    w, h, planes, bpp = struct.unpack_from('<iiHH', d, 18)
    comp = struct.unpack_from('<I', d, 30)[0]
    assert bpp in (24, 32) and comp in (0, 3), (bpp, comp)
    bypp = bpp // 8
    stride = (w * bypp + 3) // 4 * 4
    flip = h > 0
    h = abs(h)
    rows = []
    for y in range(h):
        sy = (h - 1 - y) if flip else y
        base = off + sy * stride
        rows.append(d[base:base + w * bypp])
    return w, h, bypp, rows

w, h, bypp, rows = read_bmp(TMP)
# ink = pixels clearly darker/bluer than white paper
def ink(row, x):
    b, g, r = row[x*bypp], row[x*bypp+1], row[x*bypp+2]
    if bypp == 4 and row[x*bypp+3] < 90: return False   # transparent paper
    if bypp == 4 and row[x*bypp+3] >= 90 and (r+g+b) > 700: return False
    lum = 0.299*r + 0.587*g + 0.114*b
    return lum < 150 or (b - r > 60 and lum < 200)
mask = [[ink(rows[y], x) for x in range(w)] for y in range(h)]
ys = [y for y in range(h) if any(mask[y])]
xs = [x for x in range(w) if any(mask[y][x] for y in ys[::7])]
y0, y1, x0, x1 = ys[0], ys[-1], min(xs), max(xs)
pad = 4*SCALE
y0, x0 = max(0, y0-pad), max(0, x0-pad); y1, x1 = min(h-1, y1+pad), min(w-1, x1+pad)
W, H = x1-x0+1, y1-y0+1
m = [mask[y][x0:x1+1] for y in range(y0, y1+1)]
# smooth the staircase edges of the upscaled raster: box-blur the mask (integral image) and re-threshold at 50%
R = 3
integ = [[0]*(W+1) for _ in range(H+1)]
for y in range(H):
    run = 0; row = integ[y+1]; prev = integ[y]
    for x in range(W):
        run += 1 if m[y][x] else 0
        row[x+1] = prev[x+1] + run
sm = [[False]*W for _ in range(H)]
for y in range(H):
    ya, yb = max(0, y-R), min(H, y+R+1)
    for x in range(W):
        xa, xb = max(0, x-R), min(W, x+R+1)
        tot = integ[yb][xb] - integ[ya][xb] - integ[yb][xa] + integ[ya][xa]
        sm[y][x] = tot * 2 >= (yb-ya) * (xb-xa)
m = sm
# drop specks (< 12 px at 4x) via flood fill
seen = [[False]*W for _ in range(H)]
for sy in range(H):
    for sx in range(W):
        if m[sy][sx] and not seen[sy][sx]:
            st, comp = [(sx, sy)], []
            seen[sy][sx] = True
            while st:
                x, y = st.pop(); comp.append((x, y))
                for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                    if 0 <= nx < W and 0 <= ny < H and m[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx] = True; st.append((nx, ny))
            if len(comp) < 12:
                for x, y in comp: m[y][x] = False
def px(x, y): return 0 <= x < W and 0 <= y < H and m[y][x]
# boundary edges, directed so ink is on the right
edges = {}
for y in range(H):
    for x in range(W):
        if m[y][x]:
            if not px(x, y-1): edges.setdefault((x, y), []).append((x+1, y))
            if not px(x+1, y): edges.setdefault((x+1, y), []).append((x+1, y+1))
            if not px(x, y+1): edges.setdefault((x+1, y+1), []).append((x, y+1))
            if not px(x-1, y): edges.setdefault((x, y+1), []).append((x, y))
loops = []
while edges:
    start = next(iter(edges)); cur = start; pts = [cur]
    prev_dir = None
    while True:
        nxts = edges.get(cur)
        if not nxts: break
        nxt = nxts.pop()
        if not nxts: del edges[cur]
        cur = nxt
        if cur == start: break
        pts.append(cur)
    if len(pts) > 8: loops.append(pts)
def rdp(pts, eps):
    if len(pts) < 3: return pts
    (ax, ay), (bx, by) = pts[0], pts[-1]
    dx, dy = bx-ax, by-ay; n = (dx*dx+dy*dy) ** .5 or 1
    dmax, idx = 0, 0
    for i in range(1, len(pts)-1):
        d = abs(dy*(pts[i][0]-ax) - dx*(pts[i][1]-ay)) / n
        if d > dmax: dmax, idx = d, i
    if dmax > eps:
        return rdp(pts[:idx+1], eps)[:-1] + rdp(pts[idx:], eps)
    return [pts[0], pts[-1]]
def smooth_path(pts):
    far = max(range(len(pts)), key=lambda i: (pts[i][0]-pts[0][0])**2 + (pts[i][1]-pts[0][1])**2)
    a, b = pts[:far+1], pts[far:] + [pts[0]]
    p = rdp(a, 1.6)[:-1] + rdp(b, 1.6)[:-1]
    if len(p) < 4: return ''
    k = 1.0 / SCALE
    f = lambda v: ('%.2f' % (v*k)).rstrip('0').rstrip('.')
    mid = lambda a, b: ((a[0]+b[0])/2, (a[1]+b[1])/2)
    n = len(p); m0 = mid(p[-1], p[0])
    d = 'M%s %s' % (f(m0[0]), f(m0[1]))
    for i in range(n):
        c, nx = p[i], p[(i+1) % n]; e = mid(c, nx)
        d += 'Q%s %s %s %s' % (f(c[0]), f(c[1]), f(e[0]), f(e[1]))
    return d + 'Z'
path = ''.join(smooth_path(l) for l in loops)
vw, vh = W/SCALE, H/SCALE
svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %.0f %.0f" width="%.0f" height="%.0f" role="img" '
       'aria-label="SDCA shield with dragon — San Diego Chinese Academy"><title>SDCA — San Diego Chinese Academy</title>'
       '<path fill="#0B2545" fill-rule="evenodd" d="%s"/></svg>\n') % (vw, vh, vw, vh, path)
os.makedirs('public/brand', exist_ok=True)
open('public/brand/logo-mark.svg', 'w').write(svg)
print('loops', len(loops), 'bytes', len(svg), 'viewBox', round(vw), round(vh))
