#!/usr/bin/env python3
"""Build the 3-part logo family from public/brand/logo-mark.svg (traced original mark).
Part 1 = blue rounded badge with white shield mark; Part 2 = badge + Chinese name; Part 3 = + English name and 'Non-Profit · Since 1988'.
Writes public/brand/logo-1-badge*.svg, logo-2-badge-name*.svg, logo-3-full*.svg (light + -dark variants for navy backgrounds)."""
import re
src = open('public/brand/logo-mark.svg').read()
D = re.search(r' d="([^"]+)"', src).group(1)
BLUE = '#210488'; NAVY = '#0B2545'; GRAY = '#5B6B84'
SERIF_ZH = "'Noto Serif TC','Songti TC','PMingLiU',serif"
SERIF_EN = "Georgia,'Times New Roman',serif"
BW, BH = 144, 180                      # badge size: aspect matches the shield so padding is equal on all sides
PAD = 3; MH = BH - 2*PAD; S = MH / 446; MW = 353 * S   # shield almost touches the badge edges            # mark scale (fits badge with padding)
badge = (f'<rect width="{BW}" height="{BH}" rx="14" fill="{BLUE}"/>'
         f'<g transform="translate({(BW-MW)/2:.2f} {PAD}) scale({S:.5f})"><path fill="#fff" stroke="#fff" stroke-width="1.4" stroke-linejoin="round" fill-rule="evenodd" d="{D}"/></g>')
def wrap(w, body, title, h=BH):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{body}</svg>\n')
def zh(x, fill):
    t = lambda y, s: f'<text x="{x}" y="{y}" font-family="{SERIF_ZH}" font-size="70" font-weight="700" letter-spacing="2" fill="{fill}">{s}</text>'
    return t(78, '聖地牙哥') + t(156, '中華學苑')
def en(x, fill, sub):
    return (f'<text x="{x}" y="92" font-family="{SERIF_EN}" font-size="29" font-weight="700" fill="{fill}">San Diego Chinese Academy</text>'
            f'<text x="{x}" y="132" font-family="{SERIF_EN}" font-size="21" letter-spacing="1" fill="{sub}">Non-Profit · Since 1988</text>')
ZX = BW + 14                          # Chinese text x
EX = ZX + 4*72 + 24                   # English text x
variants = {'': (NAVY, NAVY, GRAY), '-dark': ('#FFFFFF', '#FFFFFF', '#C9D3E3')}
for suf, (zc, ec, sc) in variants.items():
    open(f'public/brand/logo-1-badge{suf}.svg', 'w').write(wrap(BW, badge, 'SDCA'))
    open(f'public/brand/logo-2-badge-name{suf}.svg', 'w').write(wrap(ZX + 4*72 + 4, badge + zh(ZX, zc), '聖地牙哥中華學苑'))
    open(f'public/brand/logo-3-full{suf}.svg', 'w').write(wrap(EX + 450, badge + zh(ZX, zc) + en(EX, ec, sc), '聖地牙哥中華學苑 San Diego Chinese Academy — Non-Profit · Since 1988'))
print('ok')

# ---- high-resolution PNGs (width scaled to ~2400px) and favicons rendered from the badge ----
import subprocess, os
def png(svg_path, out, width):
    t = open(svg_path).read()
    vw, vh = map(float, re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', t).groups())
    k = width / vw
    t = re.sub(r'width="[\d.]+" height="[\d.]+"', f'width="{width}" height="{round(vh*k)}"', t, count=1)
    tmp = 'work/review/_tmp.svg'; open(tmp, 'w').write(t)
    subprocess.run(['sips', '-s', 'format', 'png', tmp, '--out', out], capture_output=True)
for base in ('logo-1-badge', 'logo-2-badge-name', 'logo-3-full'):
    for suf in ('', '-dark'):
        png(f'public/brand/{base}{suf}.svg', f'public/brand/{base}{suf}.png', 1200 if base == 'logo-1-badge' else 2400)
os.makedirs('public/favicon', exist_ok=True)
for name, px in (('favicon-32', 32), ('apple-touch-icon-180', 180), ('icon-192', 192), ('icon-512', 512)):
    pad = max(1, round(px * 0.04)); ih = px - 2*pad; iw = round(ih * BW / BH)
    inner = badge
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {px} {px}" width="{px}" height="{px}">'
           f'<svg x="{(px-iw)/2:.1f}" y="{pad}" width="{iw}" height="{ih}" viewBox="0 0 {BW} {BH}">{inner}</svg></svg>')
    open('work/review/_fav.svg', 'w').write(svg)
    subprocess.run(['sips', '-s', 'format', 'png', 'work/review/_fav.svg', '--out', f'public/favicon/{name}.png'], capture_output=True)
subprocess.run(['sips', '-s', 'format', 'ico', 'public/favicon/favicon-32.png', '--out', 'public/favicon/favicon.ico'], capture_output=True)
print('png+favicons ok')
