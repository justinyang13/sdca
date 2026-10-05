#!/usr/bin/env python3
"""Build the 3-part logo family from public/brand/logo-mark.svg (traced original mark).
Part 1 = red rounded badge with white shield mark; Part 2 = badge + Chinese name; Part 3 = + English name and 'Non-Profit · Since 1988'.
Writes public/brand/logo-1-badge*.svg, logo-2-badge-name*.svg, logo-3-full*.svg (light + -dark variants for navy backgrounds)."""
import re
src = open('public/brand/logo-mark.svg').read()
D = re.search(r' d="([^"]+)"', src).group(1)
RED = '#B3112A'; NAVY = '#0B2545'; GRAY = '#5B6B84'
SERIF_ZH = "'Noto Serif TC','Songti TC','PMingLiU',serif"
SERIF_EN = "Georgia,'Times New Roman',serif"
BW, BH = 150, 180                      # badge size
S = 134 / 446; MW = 353 * S            # mark scale (fits badge with padding)
badge = (f'<rect width="{BW}" height="{BH}" rx="14" fill="{RED}"/>'
         f'<g transform="translate({(BW-MW)/2:.2f} {(BH-134)/2:.2f}) scale({S:.5f})"><path fill="#fff" fill-rule="evenodd" d="{D}"/></g>')
def wrap(w, body, title, h=BH):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{body}</svg>\n')
def zh(x, fill):
    t = lambda y, s: f'<text x="{x}" y="{y}" font-family="{SERIF_ZH}" font-size="70" font-weight="700" letter-spacing="2" fill="{fill}">{s}</text>'
    return t(78, '聖地牙哥') + t(156, '中華學苑')
def en(x, fill, sub):
    return (f'<text x="{x}" y="92" font-family="{SERIF_EN}" font-size="29" font-weight="700" fill="{fill}">San Diego Chinese Academy</text>'
            f'<text x="{x}" y="132" font-family="{SERIF_EN}" font-size="21" letter-spacing="1" fill="{sub}">Non-Profit · Since 1988</text>')
ZX = BW + 24                          # Chinese text x
EX = ZX + 4*72 + 24                   # English text x
variants = {'': (NAVY, NAVY, GRAY), '-dark': ('#FFFFFF', '#FFFFFF', '#C9D3E3')}
for suf, (zc, ec, sc) in variants.items():
    open(f'public/brand/logo-1-badge{suf}.svg', 'w').write(wrap(BW, badge, 'SDCA'))
    open(f'public/brand/logo-2-badge-name{suf}.svg', 'w').write(wrap(ZX + 4*72 + 4, badge + zh(ZX, zc), '聖地牙哥中華學苑'))
    open(f'public/brand/logo-3-full{suf}.svg', 'w').write(wrap(EX + 450, badge + zh(ZX, zc) + en(EX, ec, sc), '聖地牙哥中華學苑 San Diego Chinese Academy — Non-Profit · Since 1988'))
print('ok')
