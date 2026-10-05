# Navigation — header & footer menu structure

Source: `raw/pages/home.html` (identical nav on every page), `pages.jsonl` `text_footer` field,
footer text from `raw/pages/*.html`. The site has **one global header menu** (OceanWP
primary menu) plus a **footer** with contact info and legal links. There is **no language
switcher** — EN and ZH text are both baked into every page.

## Header menu (exact, in DOM order)

Top-level items are shown in bold; their children follow indented. "→" marks a direct
link (no children). PDFs are shown as `⟨PDF⟩`.

| # | Label (EN as on site) | Label (ZH as on site, if any) | URL | Notes |
|---|-----------------------|-------------------------------|-----|-------|
| 1 | **Home** | — | `https://sandiegochineseschool.com/` | |
| 2 | **About** | — | (group header, not itself linked) | |
| 2.1 | About SDCA | — | `/about-sdca/` | |
| 2.2 | Board of Directors | — | `/board-of-directors/` | |
| 2.3 | Staff | — | `/staff/` | |
| 3 | **Weekly Announcement** | 家庭聯絡事項 (used as label on `/upcoming-event/`) | `/upcoming-event/` | |
| 4 | **News** | — | `/news/` | |
| 5 | **Contact Us** | — | `/countact-us/` | typo in slug |
| 6 | **Class** | 課程 (used as label) | (group header) | |
| 6.1 | Class Descriptions | 課程安排 | `/class-placement/` | |
| 6.2 | Adult Chinese TCML | 成人華語文班 | `/tcml/` | |
| 6.3 | Bell Schedule | — | `⟨PDF⟩ /wp-content/uploads/2018/10/Class-Schedule.pdf` | external PDF link |
| 6.4 | Textbooks | — | `⟨PDF⟩ /wp-content/uploads/2018/10/2018-2019-P07_Textbook_list_20180831.pdf` | 2018-19 textbook list still linked |
| 6.5 | TA Program | — | `/ta-program/` | |
| 7 | **Media** | — | `/media/` | |
| 8 | **Parent Info** | — | (group header) | |
| 8.1 | Volunteer | 義工服務 | `/volunteer-opportunity/` | |
| 8.2 | School Calendar | 行事曆 | `⟨PDF⟩ /wp-content/uploads/2026/10/2026-27_School_Calendar.pdf` | direct PDF |
| 9 | **Policy & Form** | — | `/handbook-and-policy/` | |
| 10 | **Recreational Program** | 成人文化課 | `/adult-recreational-programs/` | |
| 11 | **Sponsors** | 贊助商 | `/sponsors-2/` | Note: menu links to `/sponsors-2/` (logos), not `/sponsors/` (donations) |
| 12 | **Enroll** | — | `/registration/` | |

Additional header elements (not in the menu, but present in the top bar / logo area):

- **Logo / header banner**: `SDCA-Header-2018.png` (993×115) — the school name banner,
  linked to home. Served from every page (see `assets.md`).
- **Search box**: a `<form action="/" method="get"><input name="s">` (WordPress core
  search) in the top bar on every page.
- **Portal Sign In** link in the footer (see below) → `https://register.sandiegochineseschool.com/signin`.
- **Social icons** in the footer: Facebook, Yelp, YouTube, PTA blog (see footer table).

## Footer (exact, in DOM order)

Footer is a single block (OceanWP footer widget area) with these sections:

### 1. "Follow Us" / social links
| Label | URL |
|-------|-----|
| Facebook | `https://www.facebook.com/SanDiegoChineseAcademy/` |
| Yelp | `https://www.yelp.com/biz/san-diego-chinese-academy-san-diego` |
| YouTube (playlist) | `https://www.youtube.com/playlist?list=PL-etO5dM7pdvvPot-VAjFbX9Memc-K4fx` (anchor "SDCA Cultural Activity Playlist") |
| PTA blog | `http://sdcapta.blogspot.com/` |

### 2. Legal / portal links
| Label | URL |
|-------|-----|
| Terms of Use | — (no link target found in crawl; label only) |
| Privacy Policy | `/privacy-policy/` |
| Disclaimer | `/disclaimer/` |
| **Portal Sign In** | `https://register.sandiegochineseschool.com/signin` |

### 3. Contact block
```
Contact Info
San Diego Chinese Academy
P.O. Box 910093
San Diego, CA 92191
(858)205-SDCA (7322)
Office.SDCA@gmail.com
https://sandiegochineseschool.com
```
(source: `text_footer` field of `pages.jsonl` for the home page)

### 4. Copyright
`Copyright @ 2025 Regents of the San Diego Chinese Academy. All rights reserved.`

### 5. Repeated menu (mobile / footer nav)
The **exact same header menu** (items 1–12 above) is repeated in the footer as a
"Menu" block — this is OceanWP's footer-menu widget.

## Language switcher behaviour

**There is no language switcher.** Confirmed by:

- No `hreflang` links, no WPML / Polylang / TranslatePress plugin in the plugin list
  (`pages.jsonl` `plugins` field only ever shows `elementor`, `ocean-extra`, `smart-slider-3`).
- No `?lang=` or `/zh/` or `/en/` URL variants anywhere in `internal_links` or `external_links`.
- The `<html lang="zh-TW">` attribute is set site-wide regardless of which "language"
  the reader is interested in.
- Bilingual content is achieved by **putting both EN and ZH text in the same page**,
  usually in parallel blocks (ZH first, then EN, or vice versa depending on the section).

## Mobile menu

The mobile menu is the same list (OceanWP hamburger). The `body` class list on the home
page includes `sidebar-mobile`, and the raw HTML shows a "Close Menu" button followed by
the identical flat list of all 21 leaf links (no hierarchy preserved on mobile).

## Menu quirks / bugs (to fix in new site)

1. **`/sponsors-2/`** is the menu target for "Sponsors" — the donation page is at
   `/sponsors/`. Two different pages share the same concept.
2. **`/countact-us/`** — typo in the URL slug.
3. **Textbooks** link still points to the **2018-19** textbook list PDF.
4. **Bell Schedule** link points to a 2018 PDF (`Class-Schedule.pdf`), not a current one.
5. **"Terms of Use"** label appears in the footer but has no discernible link target
   in the crawled HTML (possibly a dead anchor).
6. The **header menu has no "Home" in Chinese** and no ZH labels for most items;
   ZH labels appear only in the in-page text.
7. The **"Enroll"** menu item and the **home-page "2026-2027 學年度網上註冊"** block
   both point to `/registration/`, which in turn links to the external
   `register.sandiegochineseschool.com` portal.
